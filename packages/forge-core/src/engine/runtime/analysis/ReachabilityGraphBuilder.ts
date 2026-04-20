import {
  ReachabilityRuntimePlan,
  ReachabilityStepEntry,
  ReachabilityTieBreakerEntry,
} from '../../compilation/RuntimePlanBuilder'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter } from '../../compilation/thunks/types'
import { resolveRedirectTarget } from '../resolution/redirectTarget'
import { pickTieBreakerWinner } from '../resolution/tieBreakerSelection'
import StepValidityAnalyzer from '../evaluation/StepValidityAnalyzer'
import { JourneyRouteTemplateCatalog } from '../types/routes.type'
import { NodeId } from '../../types/ast.type'
import { NavigationStepState } from '../types/NavigationEvaluation.type'

export default class ReachabilityGraphBuilder {
  async build(
    plan: ReachabilityRuntimePlan,
    currentStepId: NodeId | undefined,
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
    stepValidityAnalyzer: StepValidityAnalyzer,
  ): Promise<NavigationStepState[]> {
    const steps = this.createStepStates(plan.entries, routeTemplateCatalog)

    if (plan.reachabilityDisabled) {
      steps.forEach(step => {
        step.isReachable = true
      })
      await this.evaluateTieBreakers(steps, plan.entries, invoker, context)

      return steps
    }

    await this.seedEntryPoints(steps, plan.entries, invoker, context)
    await this.walkReachabilityGraph(
      steps,
      plan,
      routeTemplateCatalog,
      invoker,
      context,
      currentStepId,
      stepValidityAnalyzer,
    )
    await this.evaluateTieBreakers(steps, plan.entries, invoker, context)

    return steps
  }

  private createStepStates(
    entries: ReachabilityStepEntry[],
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
  ): NavigationStepState[] {
    return entries.map((entry, declarationIndex) => {
      const routeTemplatePath = routeTemplateCatalog.routeTemplatePathByStepId.get(entry.stepId)

      if (!routeTemplatePath) {
        throw new Error(`Route template path missing for step ${entry.stepId}`)
      }

      return {
        stepId: entry.stepId,
        routeTemplatePath,
        code: entry.code,
        declarationIndex,
        isEntryPoint: entry.isEntryPoint,
        isConditionalEntry: false,
        hasValidation: entry.hasValidation,
        isReachable: false,
        isValid: true,
        forwardRouteTemplatePaths: [],
        predecessorRouteTemplatePaths: [],
      }
    })
  }

  private async seedEntryPoints(
    steps: NavigationStepState[],
    entries: ReachabilityStepEntry[],
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<void> {
    entries.forEach((entry, index) => {
      if (entry.isEntryPoint) {
        steps[index].isReachable = true
      }
    })

    await Promise.all(
      entries.map(async (entry, index) => {
        if (entry.entryWhenNodeId === undefined) {
          return
        }

        const result = await invoker.invoke(entry.entryWhenNodeId, context)

        if (!result.error && Boolean(result.value)) {
          steps[index].isReachable = true
          steps[index].isConditionalEntry = true
        }
      }),
    )
  }

  private async walkReachabilityGraph(
    steps: NavigationStepState[],
    plan: ReachabilityRuntimePlan,
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
    currentStepId: NodeId | undefined,
    stepValidityAnalyzer: StepValidityAnalyzer,
  ): Promise<void> {
    if (steps.length === 0) {
      return
    }

    const resumeConfigured = plan.resumeAlways || plan.resumeWhenNodeId !== undefined
    const isCurrentStepAnActiveEntry = steps.some(step => step.isReachable && step.stepId === currentStepId)

    if (!resumeConfigured && isCurrentStepAnActiveEntry) {
      return
    }

    const entryByStepId = new Map(plan.entries.map(entry => [entry.stepId, entry]))
    const stateByRouteTemplatePath = new Map(steps.map(step => [step.routeTemplatePath, step]))
    const visited = new Set<string>()
    const queue = steps.filter(step => step.isReachable).map(step => step.routeTemplatePath)

    while (queue.length > 0) {
      const currentRouteTemplatePath = queue.shift()

      if (currentRouteTemplatePath === undefined || visited.has(currentRouteTemplatePath)) {
        continue
      }

      visited.add(currentRouteTemplatePath)

      const current = stateByRouteTemplatePath.get(currentRouteTemplatePath)

      if (!current) {
        continue
      }

      const entry = entryByStepId.get(current.stepId)

      if (!entry) {
        continue
      }

      const shouldEvaluateCurrentStep = current.stepId !== currentStepId || resumeConfigured

      if (!shouldEvaluateCurrentStep) {
        continue
      }

      if (entry.hasValidation) {
        current.isValid = (await stepValidityAnalyzer.execute(entry, invoker, context)).isValid
      }

      current.forwardRouteTemplatePaths = await this.resolveForwardPaths(
        current.routeTemplatePath,
        entry.forwardOutcomeIds,
        routeTemplateCatalog,
        invoker,
        context,
      )

      current.forwardRouteTemplatePaths.forEach(forwardRouteTemplatePath => {
        const next = stateByRouteTemplatePath.get(forwardRouteTemplatePath)

        if (!next) {
          return
        }

        if (!next.predecessorRouteTemplatePaths.includes(current.routeTemplatePath)) {
          next.predecessorRouteTemplatePaths.push(current.routeTemplatePath)
        }

        if (!current.isValid) {
          return
        }

        if (!next.isReachable) {
          next.isReachable = true
        }

        if (!visited.has(next.routeTemplatePath)) {
          queue.push(next.routeTemplatePath)
        }
      })
    }
  }

  private async resolveForwardPaths(
    currentRouteTemplatePath: string,
    outcomeIds: NodeId[],
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<string[]> {
    const routeTemplatePaths: string[] = []

    for (const outcomeId of outcomeIds) {
      const result = await invoker.invoke(outcomeId, context)

      if (result.error || result.value === undefined) {
        continue
      }

      const resolvedTarget = resolveRedirectTarget(String(result.value), {
        origin: 'https://forge.local',
        pathname: currentRouteTemplatePath,
      })

      if (!routeTemplateCatalog.stepIdByRouteTemplatePath.has(resolvedTarget.pathname)) {
        continue
      }

      if (!routeTemplatePaths.includes(resolvedTarget.pathname)) {
        routeTemplatePaths.push(resolvedTarget.pathname)
      }
    }

    return routeTemplatePaths
  }

  private async evaluateTieBreakers(
    steps: NavigationStepState[],
    entries: ReachabilityStepEntry[],
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<void> {
    for (let index = 0; index < steps.length; index++) {
      if (!steps[index].isReachable) {
        continue
      }

      steps[index].tieBreakerPriority = await this.resolveTieBreakerPriority(
        entries[index].reachabilityTieBreakers,
        invoker,
        context,
      )
    }
  }

  private async resolveTieBreakerPriority(
    tieBreakers: ReachabilityTieBreakerEntry[],
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<number | undefined> {
    for (const tieBreaker of tieBreakers) {
      if (tieBreaker.whenNodeId === undefined) {
        return tieBreaker.priority
      }

      const result = await invoker.invoke(tieBreaker.whenNodeId, context)

      if (!result.error && Boolean(result.value)) {
        return tieBreaker.priority
      }
    }

    return undefined
  }

  resolveDefaultEntryRouteTemplatePath(steps: NavigationStepState[]): string | undefined {
    const activeEntries = steps.filter(step => this.isActiveEntry(step))
    const winner = pickTieBreakerWinner(activeEntries)

    if (winner) {
      return winner.routeTemplatePath
    }

    return steps[0]?.routeTemplatePath
  }

  private isActiveEntry(step: NavigationStepState): boolean {
    return step.isEntryPoint || step.isConditionalEntry
  }
}
