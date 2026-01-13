import { NodeId } from '@form-engine/core/types/engine.type'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import {
  ThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/compilation/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { ParamsPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { getByPath } from '@form-engine/utils/utils'
import { getPseudoNodeKey } from '@form-engine/core/utils/pseudoNodeKeyExtractor'
import NodeRegistry from '@form-engine/core/compilation/registries/NodeRegistry'

/**
 * Handler for params namespace references
 *
 * Resolves ['params', 'paramKey', ...nestedPath] by invoking the pseudo node
 * for 'paramKey' and navigating into the result.
 *
 * Synchronous when path is static (string literal).
 * Asynchronous when path contains dynamic expressions.
 */
export default class ParamsReferenceHandler implements ThunkHandler {
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
      const pathParam = path[1] as string
      const pseudoNode = this.findPseudoNodeInRegistry(deps.nodeRegistry, pathParam)

      if (pseudoNode) {
        // Check if the pseudo node's handler is async (ParamsHandler is always sync currently)
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
    const relatedPseudoNode = this.findPseudoNodeInRegistry(context.nodeRegistry, path[1] as string)
    const baseValue = relatedPseudoNode
      ? invoker.invokeSync(relatedPseudoNode.id, context).value
      : context.request.params[path[1] as string]

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

    const relatedPseudoNode = this.findPseudoNodeInRegistry(context.nodeRegistry, path[1] as string)
    const baseValue = relatedPseudoNode
      ? (await invoker.invoke(relatedPseudoNode.id, context)).value
      : context.request.params[path[1] as string]

    return { value: getByPath(baseValue, path.slice(2).join('.')) }
  }

  private findPseudoNodeInRegistry(nodeRegistry: NodeRegistry, paramName: string): ParamsPseudoNode | undefined {
    return nodeRegistry.findByType<ParamsPseudoNode>(PseudoNodeType.PARAMS)
      .find(node => getPseudoNodeKey(node) === paramName)
  }
}
