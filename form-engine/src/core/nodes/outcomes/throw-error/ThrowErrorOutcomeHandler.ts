import { NodeId } from '@form-engine/core/types/engine.type'
import { ThrowErrorOutcomeASTNode } from '@form-engine/core/types/expressions.type'
import {
  ThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/compilation/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { evaluateOperand } from '@form-engine/core/utils/thunkEvaluatorsAsync'
import { evaluateOperandSync } from '@form-engine/core/utils/thunkEvaluatorsSync'
import { isASTNode } from '@form-engine/core/typeguards/nodes'

/**
 * Result of a throw error outcome evaluation
 *
 * Returns the error data when the `when` condition matches (or is absent),
 * undefined otherwise.
 */
export interface ThrowErrorOutcomeData {
  status: number
  message: string
}

export type ThrowErrorOutcomeResult = ThrowErrorOutcomeData | undefined

/**
 * Handler for ThrowError Outcome nodes
 *
 * Evaluates a throw error outcome by:
 * 1. Evaluating the optional 'when' condition
 * 2. If 'when' is truthy (or not present), returning { status, message }
 * 3. If 'when' is falsy, returning undefined (condition not met)
 *
 * The 'message' can be:
 * - A string (returned as-is)
 * - An AST node (evaluated dynamically, e.g., Format expression)
 *
 * Used in transition `next` arrays with first-match semantics.
 */
export default class ThrowErrorOutcomeHandler implements ThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: ThrowErrorOutcomeASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const { when, message } = this.node.properties

    // Check if when is async
    let whenIsAsync = false

    if (when && isASTNode(when)) {
      const whenHandler = deps.thunkHandlerRegistry.get(when.id)

      whenIsAsync = whenHandler?.isAsync ?? true
    }

    // Check if message is async
    let messageIsAsync = false

    if (isASTNode(message)) {
      const messageHandler = deps.thunkHandlerRegistry.get(message.id)

      messageIsAsync = messageHandler?.isAsync ?? true
    }

    // Async if when or message is async
    this.isAsync = whenIsAsync || messageIsAsync
  }

  evaluateSync(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): HandlerResult<ThrowErrorOutcomeResult> {
    const { when, status, message } = this.node.properties

    // If there's a 'when' condition, evaluate it first
    if (when) {
      const whenValue = evaluateOperandSync(when, context, invoker)

      // If condition is falsy or failed, this error doesn't apply
      if (!whenValue) {
        return { value: undefined }
      }
    }

    // Evaluate the message (may be AST node or string)
    const messageValue = evaluateOperandSync(message, context, invoker)

    return {
      value: {
        status,
        message: messageValue !== undefined ? String(messageValue) : '',
      },
    }
  }

  async evaluate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<HandlerResult<ThrowErrorOutcomeResult>> {
    const { when, status, message } = this.node.properties

    // If there's a 'when' condition, evaluate it first
    if (when) {
      const whenValue = await evaluateOperand(when, context, invoker)

      // If condition is falsy or failed, this error doesn't apply
      if (!whenValue) {
        return { value: undefined }
      }
    }

    // Evaluate the message (may be AST node or string)
    const messageValue = await evaluateOperand(message, context, invoker)

    return {
      value: {
        status,
        message: messageValue !== undefined ? String(messageValue) : '',
      },
    }
  }
}
