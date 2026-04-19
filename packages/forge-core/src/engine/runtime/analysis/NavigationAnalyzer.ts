import {
  ReachabilityRuntimePlan,
  ReachabilityStepEntry,
  ReachabilityTieBreakerEntry,
} from '../../compilation/RuntimePlanBuilder'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter } from '../../compilation/thunks/types'
import { resolveRedirectTarget } from '../resolution/redirectTarget'
import { pickTieBreakerWinner } from '../resolution/tieBreakerSelection'
import { NodeId } from '../../types/ast.type'
import { NavigationEvaluation, NavigationStepState } from '../types/NavigationEvaluation.type'
import StepValidityAnalyzer from '../evaluation/StepValidityAnalyzer'
import { JourneyRouteTemplateCatalog } from '../types/routes.type'

export default class NavigationAnalyzer {
  async evaluate(
    plan: ReachabilityRuntimePlan,
    currentStepId: NodeId | undefined,
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
    stepValidityAnalyzer: StepValidityAnalyzer,
  ): Promise<NavigationEvaluation> {
    const steps = this.createStepStates(plan.entries, routeTemplateCatalog)

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

    const resumeActive = await this.evaluateResumeCondition(plan, invoker, context)
    const redirectTargetRouteTemplatePath = this.computeResumeFrontier(steps)

    return { currentStepId, steps, redirectTargetRouteTemplatePath, resumeActive }
  }

  // ── Stage 1: Initialise step states ───────────────────────────────

  private createStepStates(
    entries: ReachabilityStepEntry[],
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
  ): NavigationStepState[] {
    return entries.map(entry => {
      const routeTemplatePath = routeTemplateCatalog.routeTemplatePathByStepId.get(entry.stepId)

      if (!routeTemplatePath) {
        throw new Error(`Route template path missing for step ${entry.stepId}`)
      }

      return {
        stepId: entry.stepId,
        routeTemplatePath,
        code: entry.code,
        isEntryPoint: entry.isEntryPoint,
        isConditionalEntry: false,
        isReachable: false,
        isValid: true,
        forwardRouteTemplatePaths: [],
        predecessorRouteTemplatePaths: [],
      }
    })
  }

  // ── Stage 2: Seed entry points ────────────────────────────────────

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

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]

      if (entry.entryWhenNodeId !== undefined) {
        const result = await invoker.invoke(entry.entryWhenNodeId, context)

        if (!result.error && Boolean(result.value)) {
          steps[i].isReachable = true
          steps[i].isConditionalEntry = true
        }
      }
    }

    if (steps.length > 0 && !steps.some(step => step.isReachable)) {
      steps[0].isReachable = true
    }
  }

  // ── Stage 3: BFS reachability walk ────────────────────────────────

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

    if (
      !resumeConfigured &&
      currentStepId !== undefined &&
      steps.some(step => step.isReachable && step.stepId === currentStepId)
    ) {
      return
    }

    const entryByStepId = new Map(plan.entries.map(entry => [entry.stepId, entry]))
    const stateByRouteTemplatePath = new Map(steps.map(step => [step.routeTemplatePath, step]))
    const visited = new Set<string>()
    const queue = steps.filter(step => step.isReachable).map(step => step.routeTemplatePath)

    while (queue.length > 0) {
      const currentPath = queue.shift()!

      if (visited.has(currentPath)) {
        continue
      }

      visited.add(currentPath)

      const current = stateByRouteTemplatePath.get(currentPath)

      if (!current) {
        continue
      }

      const entry = entryByStepId.get(current.stepId)

      if (!entry) {
        continue
      }

      const isCurrentTargetStep = current.stepId === currentStepId

      if (!isCurrentTargetStep) {
        current.isValid = (await stepValidityAnalyzer.execute(entry, invoker, context)).isValid

        current.forwardRouteTemplatePaths = await this.resolveForwardPaths(
          current.routeTemplatePath,
          entry.forwardOutcomeIds,
          routeTemplateCatalog,
          invoker,
          context,
        )
      }

      if (current.isValid) {
        current.forwardRouteTemplatePaths.forEach(forwardPath => {
          const next = stateByRouteTemplatePath.get(forwardPath)

          if (!next) {
            return
          }

          if (!next.predecessorRouteTemplatePaths.includes(current.routeTemplatePath)) {
            next.predecessorRouteTemplatePaths.push(current.routeTemplatePath)
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

      if (!result.error && result.value !== undefined) {
        const resolvedTarget = resolveRedirectTarget(String(result.value), {
          origin: 'https://forge.local',
          pathname: currentRouteTemplatePath,
        })

        if (
          routeTemplateCatalog.stepIdByRouteTemplatePath.has(resolvedTarget.pathname) &&
          !routeTemplatePaths.includes(resolvedTarget.pathname)
        ) {
          routeTemplatePaths.push(resolvedTarget.pathname)
        }
      }
    }

    return routeTemplatePaths
  }

  // ── Stage 4: Post-walk tie-breaker evaluation ─────────────────────

  private async evaluateTieBreakers(
    steps: NavigationStepState[],
    entries: ReachabilityStepEntry[],
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<void> {
    for (let i = 0; i < steps.length; i++) {
      if (!steps[i].isReachable) {
        continue
      }

      steps[i].tieBreakerPriority = await this.resolveTieBreakerPriority(
        entries[i].reachabilityTieBreakers,
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

  // ── Stage 5: Resume condition ─────────────────────────────────────

  private async evaluateResumeCondition(
    plan: ReachabilityRuntimePlan,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<boolean> {
    if (plan.resumeAlways) {
      return true
    }

    if (plan.resumeWhenNodeId === undefined) {
      return false
    }

    const result = await invoker.invoke(plan.resumeWhenNodeId, context)

    return !result.error && Boolean(result.value)
  }

  // ── Stage 6: Resume frontier computation ──────────────────────────

  private computeResumeFrontier(steps: NavigationStepState[]): string | undefined {
    if (steps.length === 0) {
      return undefined
    }

    return this.findProgressBlockerTarget(steps) ?? this.findEntryLevelTarget(steps) ?? this.findWalkTerminalTarget(steps)
  }

  private findProgressBlockerTarget(steps: NavigationStepState[]): string | undefined {
    const progressBlockers = steps.filter(
      step => step.isReachable && !step.isValid && !step.isEntryPoint && !step.isConditionalEntry,
    )

    return pickTieBreakerWinner(progressBlockers)?.routeTemplatePath
  }

  private findEntryLevelTarget(steps: NavigationStepState[]): string | undefined {
    const entryBlockers = steps.filter(
      step => step.isReachable && !step.isValid && (step.isEntryPoint || step.isConditionalEntry),
    )
    const activeConditionalEntries = steps.filter(step => step.isConditionalEntry && step.isReachable && step.isValid)
    const candidates = [...entryBlockers, ...activeConditionalEntries]

    return pickTieBreakerWinner(candidates)?.routeTemplatePath
  }

  private findWalkTerminalTarget(steps: NavigationStepState[]): string | undefined {
    const entrySteps = steps.filter(step => step.isEntryPoint || step.isConditionalEntry)
    const start = pickTieBreakerWinner(entrySteps) ?? steps[0]

    if (!start) {
      return undefined
    }

    return this.walkToTerminal(start, steps).routeTemplatePath
  }

  private walkToTerminal(start: NavigationStepState, steps: NavigationStepState[]): NavigationStepState {
    const stateByRouteTemplatePath = new Map(steps.map(step => [step.routeTemplatePath, step]))
    const visited = new Set<string>([start.routeTemplatePath])
    let current = start

    while (current.forwardRouteTemplatePaths.length > 0) {
      const candidates = current.forwardRouteTemplatePaths
        .map(path => stateByRouteTemplatePath.get(path))
        .filter((step): step is NavigationStepState => step !== undefined && !visited.has(step.routeTemplatePath))

      if (candidates.length === 0) {
        return current
      }

      const next = pickTieBreakerWinner(candidates)

      if (!next) {
        return current
      }

      visited.add(next.routeTemplatePath)
      current = next
    }

    return current
  }
}
