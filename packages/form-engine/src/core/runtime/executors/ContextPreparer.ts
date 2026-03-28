import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import ThunkEvaluator from '@form-engine/core/compilation/thunks/ThunkEvaluator'
import { StepRequest, StepResponse } from '@form-engine/core/runtime/routes/types'
import { JourneyASTNode } from '@form-engine/core/types/structures.type'
import { StepRuntimePlan } from '@form-engine/core/compilation/StepRuntimePlanBuilder'

/**
 * ContextPreparer - Creates and prepares the evaluation context before transitions run
 *
 * Creates the ThunkEvaluationContext via the evaluator, then resolves the ancestor
 * chain for a step and merges all ancestors' static data into context.global.data
 * (outermost first, so inner ancestors override outer).
 *
 * This must run before access transitions so that effects can read static data
 * via context.getData().
 */
export default class ContextPreparer {
  constructor() {}

  /**
   * Create an evaluation context and prepare it with merged static data.
   *
   * @returns A context ready for transition execution and evaluation
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
