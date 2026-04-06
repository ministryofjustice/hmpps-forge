import { ReachabilityRuntimePlan, ReachabilityStepEntry } from '../../compilation/RuntimePlanBuilder'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter } from '../../compilation/thunks/types'
import { NodeId } from '../../types/ast.type'
import { NavigationEvaluation, NavigationStepState } from '../types/NavigationEvaluation.type'
import StepValidityAnalyzer from '../evaluation/StepValidityAnalyzer'

/**
 * Evaluates navigation facts for the current journey in one shared pass.
 */
export default class NavigationAnalyzer {
  async evaluate(
    plan: ReachabilityRuntimePlan,
    currentStepId: NodeId,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
    stepValidityAnalyzer: StepValidityAnalyzer,
  ): Promise<NavigationEvaluation> {
    const steps = plan.entries.map(entry => this.createStepState(entry))

    await this.computeReachability(steps, plan, invoker, context, currentStepId, stepValidityAnalyzer)

    return {
      currentStepId,
      steps,
    }
  }

  private createStepState(entry: ReachabilityStepEntry): NavigationStepState {
    return {
      stepId: entry.stepId,
      path: entry.path,
      code: entry.code,
      isEntryPoint: entry.isEntryPoint,
      isReachable: false,
      isValid: true,
      forwardPath: undefined,
      predecessorPaths: [],
    }
  }

  private async resolveForwardPath(
    outcomeIds: NodeId[],
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<string | undefined> {
    for (const outcomeId of outcomeIds) {

      const result = await invoker.invoke(outcomeId, context)

      if (!result.error && result.value !== undefined) {
        return this.normalizePath(String(result.value))
      }
    }

    return undefined
  }

  private async computeReachability(
    steps: NavigationStepState[],
    plan: ReachabilityRuntimePlan,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
    currentStepId: NodeId,
    stepValidityAnalyzer: StepValidityAnalyzer,
  ): Promise<void> {
    if (steps.length === 0) {
      return
    }

    const entryByStepId = new Map(plan.entries.map(entry => [entry.stepId, entry]))
    const stateByPath = new Map(steps.map(step => [step.path, step]))
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
    const queue = seededEntrySteps.map(step => step.path)

    while (queue.length > 0) {
      const currentPath = queue.shift()

      if (currentPath !== undefined && !visited.has(currentPath)) {
        visited.add(currentPath)

        const current = stateByPath.get(currentPath)

        if (current) {
          const entry = entryByStepId.get(current.stepId)

          if (entry) {
            const isCurrentTargetStep = current.stepId === currentStepId

            if (!isCurrentTargetStep && !evaluatedValidityStepIds.has(current.stepId)) {

              current.isValid = (await stepValidityAnalyzer.execute(entry, invoker, context)).isValid
              evaluatedValidityStepIds.add(current.stepId)
            }

            if (!isCurrentTargetStep && !evaluatedForwardPathStepIds.has(current.stepId)) {

              current.forwardPath = await this.resolveForwardPath(entry.forwardOutcomeIds, invoker, context)
              evaluatedForwardPathStepIds.add(current.stepId)
            }

            const next = current.forwardPath ? stateByPath.get(current.forwardPath) : undefined

            if (current.isValid && next) {
              if (!next.predecessorPaths.includes(current.path)) {
                next.predecessorPaths.push(current.path)
              }

              if (!next.isReachable) {
                next.isReachable = true
              }

              if (!visited.has(next.path)) {
                queue.push(next.path)
              }
            }
          }
        }
      }
    }
  }

  private normalizePath(path: string): string {
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path

    return normalizedPath.split(/[?#]/)[0] ?? normalizedPath
  }
}
