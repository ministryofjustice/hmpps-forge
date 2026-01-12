import { NodeId } from '@form-engine/core/types/engine.type'
import {
  HybridThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { evaluateOperand } from '@form-engine/core/ast/thunks/evaluation'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { XorPredicateASTNode } from '@form-engine/core/types/predicates.type'

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
 *
 * Synchronous when all operands are primitives or sync nodes.
 * Asynchronous when any operand is an async node.
 */
export default class XorHandler implements HybridThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: XorPredicateASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const operands = this.node.properties.operands

    // Check if any operand is an async AST node
    this.isAsync = operands.some(operand => {
      if (isASTNode(operand)) {
        const handler = deps.thunkHandlerRegistry.get(operand.id)

        return handler?.isAsync ?? true
      }

      return false
    })
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult {
    const operands = this.node.properties.operands

    // Empty operands array returns false (even count: 0)
    if (operands.length === 0) {
      return { value: false }
    }

    // Evaluate all operands - cannot short-circuit for XOR
    const evaluatedOperands = operands.map(operand => {
      if (isASTNode(operand)) {
        const result = invoker.invokeSync(operand.id, context)

        return result.error ? undefined : result.value
      }

      return operand
    })

    // Count truthy operands (failed evaluations are undefined, treated as falsy)
    const truthyCount = evaluatedOperands.filter(
      operandValue => operandValue !== undefined && Boolean(operandValue),
    ).length

    // XOR is true if exactly one operand is truthy
    return { value: truthyCount === 1 }
  }

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
