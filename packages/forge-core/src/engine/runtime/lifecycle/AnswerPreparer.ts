import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter } from '../../compilation/thunks/types'
import { PseudoNodeType } from '../../types/pseudoNodes.type'

export default class AnswerPreparer {
  async prepare(invoker: ThunkInvocationAdapter, context: ThunkEvaluationContext): Promise<void> {
    const localAnswerNodes = context.nodeRegistry.findByType(PseudoNodeType.ANSWER_LOCAL)
    const remoteAnswerNodes = context.nodeRegistry.findByType(PseudoNodeType.ANSWER_REMOTE)
    const answerNodes = [...localAnswerNodes, ...remoteAnswerNodes]

    for (const node of answerNodes) {
      await invoker.invoke(node.id, context)
    }
  }
}
