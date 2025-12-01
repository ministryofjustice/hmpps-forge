import { NodeId } from '@form-engine/core/types/engine.type'
import { NotPredicateASTNode } from '@form-engine/core/types/expressions.type'
import { ThunkHandler, ThunkInvocationAdapter, HandlerResult } from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { evaluateOperand } from '@form-engine/core/ast/thunks/handlers/utils/evaluation'

/**
 * Handler for NOT predicate expression nodes
 *
 * Evaluates a NOT predicate by:
 * 1. Evaluating the single operand
 * 2. Returning the negation of the operand's truthiness
 * 3. Returning true if operand is falsy, false if operand is truthy
 *
 * The operand can be:
 * - An AST node (evaluated dynamically)
 * - A primitive value (checked for truthiness as-is)
 *
 * Failed evaluations are treated as falsy (undefined → truthy when negated)
 */
export default class NotPredicateHandler implements ThunkHandler {
  constructor(
    public readonly nodeId: NodeId,
    private readonly node: NotPredicateASTNode,
  ) {}

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const operand = this.node.properties.operand

    // Evaluate the operand
    const operandValue = await evaluateOperand(operand, context, invoker)

    // Return negation of operand's truthiness
    // Failed evaluations (undefined) are treated as falsy, so NOT returns true
    return { value: !operandValue }
  }
}
