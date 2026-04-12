import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import ThunkEvaluator from '../../compilation/thunks/ThunkEvaluator'
import { StepRequest } from '../../../framework/types/request.type'
import { StepResponse } from '../../../framework/types/response.type'
import { JourneyASTNode } from '../../types/structures.type'
import { StepRuntimePlan } from '../../compilation/RuntimePlanBuilder'

/**
 * ContextPreparer - Creates and prepares the evaluation context before hooks run
 *
 * Creates the ThunkEvaluationContext via the evaluator, then resolves the ancestor
 * chain for a step and merges all ancestors' static data into context.global.data
 * (outermost first, so inner ancestors override outer).
 *
 * This must run before access hooks so that effects can read static data
 * via context.getData().
 */
export default class ContextPreparer {

  /**
   * Create an evaluation context and prepare it with merged static data.
   *
   * @returns A context ready for hook execution and evaluation
   */
  prepare(
    runtimePlan: StepRuntimePlan,
    evaluator: ThunkEvaluator,
    request: StepRequest,
    response: StepResponse,
  ): ThunkEvaluationContext {
    const context = evaluator.createContext(request, response)

    this.mergeStaticData(runtimePlan, context)

    return context
  }

  /**
   * Resolve ancestors and merge all static data into context.global.data.
   *
   * Merge order is outermost first (journeys before step), so later ancestors
   * override earlier ones via shallow merge.
   */
  private mergeStaticData(runtimePlan: StepRuntimePlan, context: ThunkEvaluationContext): void {
    const ancestors = runtimePlan.accessAncestorIds
      .map(nodeId => context.nodeRegistry.get(nodeId) as JourneyASTNode)

    ancestors.forEach(ancestor => {
      const staticData = ancestor.properties.data

      if (staticData !== undefined) {
        Object.assign(context.global.data, staticData)
      }
    })
  }
}
