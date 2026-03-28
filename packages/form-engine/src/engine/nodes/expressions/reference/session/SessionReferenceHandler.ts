import { NodeId } from '../../../../types/engine.type'
import { ReferenceASTNode } from '../../../../types/expressions.type'
import {
  ThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '../../../../compilation/thunks/types'
import ThunkEvaluationContext from '../../../../compilation/thunks/ThunkEvaluationContext'
import NodeRegistry from '../../../../compilation/registries/NodeRegistry'
import { isASTNode } from '../../../../typeguards/nodes'
import { getPseudoNodeKey } from '../../../../utils/pseudoNodeKeyExtractor'
import { safePropertyAccess } from '../../../../utils/propertyAccess'
import { getByPath } from '../../../../../shared/utils/utils'
import { PseudoNodeType, SessionPseudoNode } from '../../../../types/pseudoNodes.type'

export default class SessionReferenceHandler implements ThunkHandler {
  isAsync = false

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: ReferenceASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const path = this.node.properties.path

    if (isASTNode(path[1])) {
      const dynamicPathHandler = deps.thunkHandlerRegistry.get(path[1].id)

      this.isAsync = dynamicPathHandler?.isAsync ?? true

      return
    }

    const baseSessionKey = path[1] as string
    const pseudoNode = this.findPseudoNodeInRegistry(deps.nodeRegistry, baseSessionKey)

    if (pseudoNode) {
      const pseudoHandler = deps.thunkHandlerRegistry.get(pseudoNode.id)

      this.isAsync = pseudoHandler?.isAsync ?? true

      return
    }

    this.isAsync = false
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult {
    const path = this.node.properties.path
    const baseSessionKey = path[1] as string
    const relatedPseudoNode = this.findPseudoNodeInRegistry(context.nodeRegistry, baseSessionKey)
    const baseValue = relatedPseudoNode
      ? invoker.invokeSync(relatedPseudoNode.id, context).value
      : this.getSessionValue(context, baseSessionKey)

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

    const baseSessionKey = path[1] as string
    const relatedPseudoNode = this.findPseudoNodeInRegistry(context.nodeRegistry, baseSessionKey)
    const baseValue = relatedPseudoNode
      ? (await invoker.invoke(relatedPseudoNode.id, context)).value
      : this.getSessionValue(context, baseSessionKey)

    return { value: getByPath(baseValue, path.slice(2).join('.')) }
  }

  private findPseudoNodeInRegistry(nodeRegistry: NodeRegistry, baseSessionKey: string): SessionPseudoNode | undefined {
    return nodeRegistry.findByType<SessionPseudoNode>(PseudoNodeType.SESSION)
      .find(node => getPseudoNodeKey(node) === baseSessionKey)
  }

  private getSessionValue(context: ThunkEvaluationContext, baseSessionKey: string): unknown {
    return safePropertyAccess(context.request.getSession(), baseSessionKey)
  }
}
