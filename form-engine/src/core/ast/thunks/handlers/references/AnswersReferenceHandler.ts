import { NodeId } from '@form-engine/core/types/engine.type'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { ThunkHandler, ThunkInvocationAdapter, HandlerResult } from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { AnswerLocalPseudoNode, AnswerRemotePseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { isASTNode, isPseudoNode } from '@form-engine/core/typeguards/nodes'
import { getByPath } from '@form-engine/utils/utils'

const PSEUDO_TYPES = [PseudoNodeType.ANSWER_LOCAL, PseudoNodeType.ANSWER_REMOTE]

/**
 * Handler for answers namespace references
 *
 * Resolves ['answers', 'fieldKey', ...nestedPath] by invoking the pseudo node
 * for 'fieldKey' and navigating into the result.
 */
export default class AnswersReferenceHandler implements ThunkHandler {
  constructor(
    public readonly nodeId: NodeId,
    private readonly node: ReferenceASTNode,
  ) {}

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
      : context.global.answers[path[1] as string]?.current

    return { value: getByPath(baseValue, path.slice(2).join('.')) }
  }

  private findPseudoNode(context: ThunkEvaluationContext, baseFieldCode: string) {
    return Array.from(context.nodeRegistry.getAll().values()).find(
      (node: AnswerRemotePseudoNode | AnswerLocalPseudoNode) =>
        isPseudoNode(node) && PSEUDO_TYPES.includes(node.type) && node.properties.baseFieldCode === baseFieldCode,
    )
  }
}
