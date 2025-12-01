import { NodeId } from '@form-engine/core/types/engine.type'
import { XorPredicateASTNode } from '@form-engine/core/types/expressions.type'
import { ThunkHandler, ThunkInvocationAdapter, HandlerResult } from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { evaluateOperand } from '@form-engine/core/ast/thunks/handlers/utils/evaluation'

/**
 * Handler for XOR predicate expression nodes
 *
 * Evaluates an XOR predicate by:
 * 1. Evaluating all operands in the operands array
 * 2. Returning true if EXACTLY ONE operand is truthy
 * 3. Returning false otherwise (zero or multiple truthy)
 *
 * Operands can be:
 * - AST nodes (evaluated dynamically)
 * - Primitive values (checked for truthiness as-is)
 *
 * Unlike AND/OR, XOR cannot short-circuit since all operands must be evaluated
 * to determine the count of truthy values
 */
export default class XorPredicateHandler implements ThunkHandler {
  constructor(
    public readonly nodeId: NodeId,
    private readonly node: XorPredicateASTNode,
  ) {}

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const operands = this.node.properties.operands

    // Empty operands array returns false (even count: 0)
    if (operands.length === 0) {
      return { value: false }
    }

    // Evaluate all operands in parallel - cannot short-circuit for XOR
    const evaluatedOperands = await Promise.all(operands.map(operand => evaluateOperand(operand, context, invoker)))

    // Count truthy operands (failed evaluations are undefined, treated as falsy)
    const truthyCount = evaluatedOperands.filter(
      operandValue => operandValue !== undefined && Boolean(operandValue),
    ).length

    // XOR is true if exactly one operand is truthy
    return { value: truthyCount === 1 }
  }
}
