import { NodeId } from '../../../types/engine.type'
import { AnswerRemotePseudoNode, PseudoNodeType } from '../../../types/pseudoNodes.type'
import { ThunkHandler, HandlerResult } from '../../../compilation/thunks/types'
import ThunkEvaluationContext from '../../../compilation/thunks/ThunkEvaluationContext'
import { isSafePropertyKey } from '../../../utils/propertyAccess'
import ThunkEvaluationError from '../../../errors/ThunkEvaluationError'

/**
 * Handler for ANSWER_REMOTE pseudo nodes
 *
 * Returns resolved field answers from other steps (not the current step).
 * The answer has already been resolved and stored in context.answers by a previous OnAccess hook.
 */
export default class AnswerRemoteHandler implements ThunkHandler {
  isAsync = false

  constructor(
    public readonly nodeId: NodeId,
    private readonly pseudoNode: AnswerRemotePseudoNode,
  ) {}

  computeIsAsync(): void {
    this.isAsync = false
  }

  async evaluate(context: ThunkEvaluationContext): Promise<HandlerResult> {
    return this.evaluateSync(context)
  }

  evaluateSync(context: ThunkEvaluationContext): HandlerResult {
    const { baseFieldCode } = this.pseudoNode.properties

    // Validate field code is safe before using as property key
    if (!isSafePropertyKey(baseFieldCode)) {
      const error = ThunkEvaluationError.securityViolation(this.nodeId, baseFieldCode, PseudoNodeType.ANSWER_REMOTE)

      return { error: error.toThunkError() }
    }

    // Read previously resolved answer from context - direct return, no Promise!
    return { value: context.global.answers[baseFieldCode]?.current }
  }
}
