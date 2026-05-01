import RuntimeEvaluationContext from '../context/RuntimeEvaluationContext'
import { StepRequest } from '../../../framework/types/request.type'
import { StepResponse } from '../../../framework/types/response.type'
import { JourneyASTNode, StepASTNode } from '../../types/structures.type'
import { ASTNode, NodeId } from '../../types/engine.type'
import { CompilationDependencies } from '../../compilation/CompilationDependencies'
import { ASTNodeType } from '../../types/enums'

interface AccessRuntimeInputs {
  accessAncestorIds: NodeId[]
}

type StaticDataAncestor = JourneyASTNode | StepASTNode

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
    request: StepRequest,
    response: StepResponse,
  ): RuntimeEvaluationContext {
    const context = new RuntimeEvaluationContext(request, response)

    this.mergeStaticData(runtimePlan, compilationDependencies, context)

    return context
  }

  /**
   * Resolve ancestors and merge all static data into context.global.data.
   *
   * Merge order is outermost first (journeys before step), so later ancestors
   * override earlier ones via shallow merge.
   */
  private mergeStaticData(
    runtimePlan: AccessRuntimeInputs,
    compilationDependencies: CompilationDependencies,
    context: RuntimeEvaluationContext,
  ): void {
    const ancestors = runtimePlan.accessAncestorIds
      .map(nodeId => this.getStaticDataAncestor(nodeId, compilationDependencies))

    ancestors.forEach(ancestor => {
      const staticData = ancestor.properties.data

      if (staticData !== undefined) {
        Object.assign(context.global.data, staticData)
      }
    })
  }

  private getStaticDataAncestor(nodeId: NodeId, compilationDependencies: CompilationDependencies): StaticDataAncestor {
    const node = compilationDependencies.nodeRegistry.get(nodeId)

    if (!this.isStaticDataAncestor(node)) {
      throw new Error(`Access ancestor "${nodeId}" was not registered as a journey or step`)
    }

    return node
  }

  private isStaticDataAncestor(node: ASTNode | undefined): node is StaticDataAncestor {
    return node?.type === ASTNodeType.JOURNEY || node?.type === ASTNodeType.STEP
  }
}
