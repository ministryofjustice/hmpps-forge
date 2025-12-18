import { NodeId } from '@form-engine/core/types/engine.type'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import {
  HybridThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { DataPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { getByPath } from '@form-engine/utils/utils'

/**
 * Handler for data namespace references
 *
 * Resolves ['data', 'fieldKey', ...nestedPath] by invoking the pseudo node
 * for 'fieldKey' and navigating into the result.
 *
 * Synchronous when path is static (string literal).
 * Asynchronous when path contains dynamic expressions.
 */
export default class DataReferenceHandler implements HybridThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: ReferenceASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const path = this.node.properties.path

    // If path contains dynamic expression (ASTNode), check if it's async
    if (isASTNode(path[1])) {
      const dynamicPathHandler = deps.thunkHandlerRegistry.get(path[1].id)

      this.isAsync = dynamicPathHandler?.isAsync ?? true
    } else {
      // Static path - look up the pseudo node and check if it's async
      const dataKey = path[1] as string
      const pseudoNode = deps.nodeRegistry.findPseudoNode<DataPseudoNode>(PseudoNodeType.DATA, dataKey)

      if (pseudoNode) {
        // Check if the pseudo node's handler is async (DataHandler is always sync currently)
        const pseudoHandler = deps.thunkHandlerRegistry.get(pseudoNode.id)
        this.isAsync = pseudoHandler?.isAsync ?? true
      } else {
        // No pseudo node found - fallback is sync (direct context access)
        this.isAsync = false
      }
    }
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult {
    const path = this.node.properties.path

    // Path must be static for sync evaluation
    const relatedPseudoNode = this.findPseudoNode(context, path[1] as string)
    const baseValue = relatedPseudoNode
      ? invoker.invokeSync(relatedPseudoNode.id, context).value
      : context.global.data[path[1] as string]

    return { value: getByPath(baseValue, path.slice(2).join('.')) }
  }

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    let path = this.node.properties.path

    if (isASTNode(path[1])) {
      const dynamicPathEvaluation = await invoker.invoke(path[1].id, context)

      if (dynamicPathEvaluation.error || typeof dynamicPathEvaluation.value !== 'string') {
        return { value: undefined }
      }

      path = [path[0], ...dynamicPathEvaluation.value.split('.')]
    }

    const relatedPseudoNode = this.findPseudoNode(context, path[1] as string)
    const baseValue = relatedPseudoNode
      ? (await invoker.invoke(relatedPseudoNode.id, context)).value
      : context.global.data[path[1] as string]

    return { value: getByPath(baseValue, path.slice(2).join('.')) }
  }

  private findPseudoNode(context: ThunkEvaluationContext, baseProperty: string): DataPseudoNode | undefined {
    return context.nodeRegistry.findPseudoNode<DataPseudoNode>(PseudoNodeType.DATA, baseProperty)
  }
}
