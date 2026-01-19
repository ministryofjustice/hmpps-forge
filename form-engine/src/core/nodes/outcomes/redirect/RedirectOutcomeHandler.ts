import { NodeId } from '@form-engine/core/types/engine.type'
import { RedirectOutcomeASTNode } from '@form-engine/core/types/expressions.type'
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
 * Result of a redirect outcome evaluation
 *
 * Returns the redirect path when the `when` condition matches (or is absent),
 * undefined otherwise.
 */
export type RedirectOutcomeResult = string | undefined

/**
 * Handler for Redirect Outcome nodes
 *
 * Evaluates a redirect outcome by:
 * 1. Evaluating the optional 'when' condition
 * 2. If 'when' is truthy (or not present), returning the 'goto' destination
 * 3. If 'when' is falsy, returning undefined (condition not met)
 *
 * The 'goto' can be:
 * - A string path (returned as-is)
 * - An AST node (evaluated dynamically, e.g., Format expression)
 *
 * Used in transition `next` arrays with first-match semantics.
 */
export default class RedirectOutcomeHandler implements ThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: RedirectOutcomeASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const { when, goto } = this.node.properties

    // Check if when is async
    let whenIsAsync = false

    if (when && isASTNode(when)) {
      const whenHandler = deps.thunkHandlerRegistry.get(when.id)

      whenIsAsync = whenHandler?.isAsync ?? true
    }

    // Check if goto is async
    let gotoIsAsync = false

    if (isASTNode(goto)) {
      const gotoHandler = deps.thunkHandlerRegistry.get(goto.id)

      gotoIsAsync = gotoHandler?.isAsync ?? true
    }

    // Async if when or goto is async
    this.isAsync = whenIsAsync || gotoIsAsync
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult<RedirectOutcomeResult> {
    const { when, goto } = this.node.properties

    // If there's a 'when' condition, evaluate it first
    if (when) {
      const whenValue = evaluateOperandSync(when, context, invoker)

      // If condition is falsy or failed, this redirect doesn't apply
      if (!whenValue) {
        return { value: undefined }
      }
    }

    // Evaluate the goto destination (may be AST node or string)
    const gotoValue = evaluateOperandSync(goto, context, invoker)

    return { value: gotoValue !== undefined ? String(gotoValue) : undefined }
  }

  async evaluate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<HandlerResult<RedirectOutcomeResult>> {
    const { when, goto } = this.node.properties

    // If there's a 'when' condition, evaluate it first
    if (when) {
      const whenValue = await evaluateOperand(when, context, invoker)

      // If condition is falsy or failed, this redirect doesn't apply
      if (!whenValue) {
        return { value: undefined }
      }
    }

    // Evaluate the goto destination (may be AST node or string)
    const gotoValue = await evaluateOperand(goto, context, invoker)

    return { value: gotoValue !== undefined ? String(gotoValue) : undefined }
  }
}
