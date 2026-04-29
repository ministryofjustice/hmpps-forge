import RuntimeEvaluationContext from '../context/RuntimeEvaluationContext'
import { StepRequest } from '../../../framework/types/request.type'
import { StepResponse } from '../../../framework/types/response.type'
import { JourneyASTNode } from '../../types/structures.type'
import { JourneyInstanceDependencies, NodeId } from '../../types/engine.type'
import { CompilationDependencies } from '../../compilation/CompilationDependencies'

interface AccessRuntimeInputs {
  accessAncestorIds: NodeId[]
}

/**
 * ContextPreparer - Creates and prepares the evaluation context before hooks run
 *
 * Creates the request evaluation context, then resolves the ancestor chain and
 * merges all ancestors' static data into context.global.data
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
    runtimePlan: AccessRuntimeInputs,
    compilationDependencies: CompilationDependencies,
    journeyInstanceDependencies: JourneyInstanceDependencies,
    request: StepRequest,
    response: StepResponse,
  ): RuntimeEvaluationContext {
    const context = new RuntimeEvaluationContext(
      compilationDependencies,
      journeyInstanceDependencies,
      request,
      response,
    )

    this.mergeStaticData(runtimePlan, context)

    return context
  }

  /**
   * Resolve ancestors and merge all static data into context.global.data.
   *
   * Merge order is outermost first (journeys before step), so later ancestors
   * override earlier ones via shallow merge.
   */
  private mergeStaticData(runtimePlan: AccessRuntimeInputs, context: RuntimeEvaluationContext): void {
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
