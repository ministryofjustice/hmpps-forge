import { NodeId } from '@form-engine/core/types/engine.type'
import { AnswerRemotePseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { ThunkHandler, HandlerResult } from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { isSafePropertyKey } from '@form-engine/core/ast/utils/propertyAccess'
import ThunkEvaluationError from '@form-engine/errors/ThunkEvaluationError'

/**
 * Handler for ANSWER_REMOTE pseudo nodes
 *
 * Returns resolved field answers from other steps (not the current step).
 * The answer has already been resolved and stored in context.answers by a previous OnLoad transition.
 */
export default class AnswerRemoteHandler implements ThunkHandler {
  constructor(
    public readonly nodeId: NodeId,
    private readonly pseudoNode: AnswerRemotePseudoNode,
  ) {}

  async evaluate(context: ThunkEvaluationContext): Promise<HandlerResult> {
    const { baseFieldCode } = this.pseudoNode.properties

    // Validate field code is safe before using as property key
    if (!isSafePropertyKey(baseFieldCode)) {
      const error = ThunkEvaluationError.securityViolation(this.nodeId, baseFieldCode, PseudoNodeType.ANSWER_REMOTE)

      return { error: error.toThunkError() }
    }

    // Read previously resolved answer from context
    return { value: context.global.answers[baseFieldCode] }
  }
}
