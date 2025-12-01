import { NodeId } from '@form-engine/core/types/engine.type'
import { NextASTNode } from '@form-engine/core/types/expressions.type'
import { ThunkHandler, ThunkInvocationAdapter, HandlerResult } from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { evaluateOperand } from '@form-engine/core/ast/thunks/handlers/utils/evaluation'

/**
 * Handler for Next expression nodes (navigation/routing logic)
 *
 * Evaluates a next expression by:
 * 1. Evaluating the optional 'when' condition
 * 2. If 'when' is truthy (or not present), returning the 'goto' destination
 * 3. If 'when' is falsy, returning undefined (condition not met)
 *
 * The 'goto' can be:
 * - A string path (returned as-is)
 * - An AST node (evaluated dynamically)
 */
export default class NextHandler implements ThunkHandler {
  constructor(
    public readonly nodeId: NodeId,
    private readonly node: NextASTNode,
  ) {}

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const { when, goto } = this.node.properties

    // If there's a 'when' condition, evaluate it first
    if (when) {
      const whenValue = await evaluateOperand(when, context, invoker)

      // If condition is falsy or failed, this next expression doesn't apply
      if (!whenValue) {
        return { value: undefined }
      }
    }

    // Evaluate the goto destination (may be AST node or string)
    const gotoValue = await evaluateOperand(goto, context, invoker)

    return { value: gotoValue }
  }
}
