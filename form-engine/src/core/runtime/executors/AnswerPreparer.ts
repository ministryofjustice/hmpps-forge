import { StepRuntimePlan } from '@form-engine/core/compilation/StepRuntimePlanBuilder'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter } from '@form-engine/core/compilation/thunks/types'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'

/**
 * AnswerPreparer - Materialises runtime field nodes and resolves answer pseudo nodes
 *
 * This runs before action and submit transitions so transition effects can read
 * step answers through the normal answer-resolution pipeline rather than raw POST data.
 */
export default class AnswerPreparer {
  constructor() {}

  async prepare(
    runtimePlan: StepRuntimePlan,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<void> {
    await this.expandFieldIterators(runtimePlan.fieldIteratorRootIds, invoker, context)

    await this.evaluateAnswerPseudoNodes(invoker, context)
  }

  prepareSync(runtimePlan: StepRuntimePlan, invoker: ThunkInvocationAdapter, context: ThunkEvaluationContext): void {
    for (const iteratorRootId of runtimePlan.fieldIteratorRootIds) {
      invoker.invokeSync(iteratorRootId, context)
    }

    const localAnswerNodes = context.nodeRegistry.findByType(PseudoNodeType.ANSWER_LOCAL)
    const remoteAnswerNodes = context.nodeRegistry.findByType(PseudoNodeType.ANSWER_REMOTE)

    for (const node of [...localAnswerNodes, ...remoteAnswerNodes]) {
      invoker.invokeSync(node.id, context)
    }
  }

  private async expandFieldIterators(
    fieldIteratorRootIds: StepRuntimePlan['fieldIteratorRootIds'],
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<void> {
    if (fieldIteratorRootIds.length === 0) {
      return
    }

    for (const iteratorRootId of fieldIteratorRootIds) {
      // eslint-disable-next-line no-await-in-loop
      await invoker.invoke(iteratorRootId, context)
    }
  }

  private async evaluateAnswerPseudoNodes(
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<void> {
    const localAnswerNodes = context.nodeRegistry.findByType(PseudoNodeType.ANSWER_LOCAL)
    const remoteAnswerNodes = context.nodeRegistry.findByType(PseudoNodeType.ANSWER_REMOTE)
    const answerNodes = [...localAnswerNodes, ...remoteAnswerNodes]

    for (const node of answerNodes) {
      // eslint-disable-next-line no-await-in-loop
      await invoker.invoke(node.id, context)
    }
  }
}
