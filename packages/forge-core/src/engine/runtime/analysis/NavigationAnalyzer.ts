import { ReachabilityRuntimePlan, ReachabilityStepEntry } from '../../compilation/RuntimePlanBuilder'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter } from '../../compilation/thunks/types'
import { resolveRedirectTarget } from '../resolution/redirectTarget'
import { NodeId } from '../../types/ast.type'
import { NavigationEvaluation, NavigationStepState } from '../types/NavigationEvaluation.type'
import StepValidityAnalyzer from '../evaluation/StepValidityAnalyzer'
import { JourneyRouteTemplateCatalog } from '../types/routes.type'

/**
 * Evaluates navigation facts for the current journey in one shared pass.
 */
export default class NavigationAnalyzer {
  async evaluate(
    plan: ReachabilityRuntimePlan,
    currentStepId: NodeId,
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
    stepValidityAnalyzer: StepValidityAnalyzer,
  ): Promise<NavigationEvaluation> {
    const steps = plan.entries.map(entry => this.createStepState(entry, routeTemplateCatalog))

    await this.computeReachability(
      steps,
      plan,
      routeTemplateCatalog,
      invoker,
      context,
      currentStepId,
      stepValidityAnalyzer,
    )

    return {
      currentStepId,
      steps,
    }
  }

  private createStepState(
    entry: ReachabilityStepEntry,
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
  ): NavigationStepState {
    const routeTemplatePath = routeTemplateCatalog.routeTemplatePathByStepId.get(entry.stepId)

    if (!routeTemplatePath) {
      throw new Error(`Route template path missing for step ${entry.stepId}`)
    }

    return {
      stepId: entry.stepId,
      routeTemplatePath,
      code: entry.code,
      isEntryPoint: entry.isEntryPoint,
      isReachable: false,
      isValid: true,
      forwardRouteTemplatePaths: [],
      predecessorRouteTemplatePaths: [],
    }
  }

  private async resolveForwardRouteTemplatePaths(
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

  private async computeReachability(
    steps: NavigationStepState[],
    plan: ReachabilityRuntimePlan,
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
    currentStepId: NodeId,
    stepValidityAnalyzer: StepValidityAnalyzer,
  ): Promise<void> {
    if (steps.length === 0) {
      return
    }

    const entryByStepId = new Map(plan.entries.map(entry => [entry.stepId, entry]))
    const stateByRouteTemplatePath = new Map(steps.map(step => [step.routeTemplatePath, step]))
    const entrySteps = plan.entries
      .map((entry, index) => ({ entry, state: steps[index] }))
      .filter(({ entry }) => entry.isEntryPoint)
      .map(({ state }) => state)
    const evaluatedValidityStepIds = new Set<NodeId>()
    const evaluatedForwardPathStepIds = new Set<NodeId>()
    const seededEntrySteps = entrySteps.length > 0 ? entrySteps : [steps[0]]

    seededEntrySteps.forEach(step => {
      step.isReachable = true
    })

    if (seededEntrySteps.some(step => step.stepId === currentStepId)) {
      return
    }

    const visited = new Set<string>()
    const queue = seededEntrySteps.map(step => step.routeTemplatePath)

    while (queue.length > 0) {
      const currentPath = queue.shift()

      if (currentPath !== undefined && !visited.has(currentPath)) {
        visited.add(currentPath)

        const current = stateByRouteTemplatePath.get(currentPath)

        if (current) {
          const entry = entryByStepId.get(current.stepId)

          if (entry) {
            const isCurrentTargetStep = current.stepId === currentStepId

            if (!isCurrentTargetStep && !evaluatedValidityStepIds.has(current.stepId)) {

              current.isValid = (await stepValidityAnalyzer.execute(entry, invoker, context)).isValid
              evaluatedValidityStepIds.add(current.stepId)
            }

            if (!isCurrentTargetStep && !evaluatedForwardPathStepIds.has(current.stepId)) {

              current.forwardRouteTemplatePaths = await this.resolveForwardRouteTemplatePaths(
                current.routeTemplatePath,
                entry.forwardOutcomeIds,
                routeTemplateCatalog,
                invoker,
                context,
              )
              evaluatedForwardPathStepIds.add(current.stepId)
            }

            if (current.isValid) {
              current.forwardRouteTemplatePaths.forEach(forwardRouteTemplatePath => {
                const next = stateByRouteTemplatePath.get(forwardRouteTemplatePath)

                if (next) {
                  if (!next.predecessorRouteTemplatePaths.includes(current.routeTemplatePath)) {
                    next.predecessorRouteTemplatePaths.push(current.routeTemplatePath)
                  }

                  if (!next.isReachable) {
                    next.isReachable = true
                  }

                  if (!visited.has(next.routeTemplatePath)) {
                    queue.push(next.routeTemplatePath)
                  }
                }
              })
            }
          }
        }
      }
    }
  }
}
