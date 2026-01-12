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
import { OrPredicateASTNode } from '@form-engine/core/types/predicates.type'

/**
 * Handler for OR predicate expression nodes
 *
 * Evaluates an OR predicate by:
 * 1. Evaluating all operands in the operands array
 * 2. Returning true if ANY operand is truthy
 * 3. Returning false if ALL operands are falsy
 *
 * Operands can be:
 * - AST nodes (evaluated dynamically)
 * - Primitive values (checked for truthiness as-is)
 *
 * Short-circuit evaluation: Stops evaluating as soon as a truthy operand is found
 *
 * Error handling: Unlike AndHandler which fails immediately on evaluation errors,
 * OrHandler continues evaluating remaining operands when one fails. This is
 * semantically correct for OR logic - we only need ONE truthy value, so a failed operand
 * doesn't prevent finding a truthy value in subsequent operands.
 *
 * Synchronous when all operands are primitives or sync nodes.
 * Asynchronous when any operand is an async node.
 */
export default class OrHandler implements HybridThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: OrPredicateASTNode,
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

    // Empty operands array returns false (no truthy values)
    if (operands.length === 0) {
      return { value: false }
    }

    // Evaluate all operands with short-circuit evaluation
    for (const operand of operands) {
      let operandValue: unknown

      if (isASTNode(operand)) {
        const result = invoker.invokeSync(operand.id, context)

        if (!result.error) {
          operandValue = result.value
        }
      } else {
        operandValue = operand
      }

      // Only check truthiness if operand evaluation succeeded
      if (operandValue !== undefined) {
        // Short-circuit: if any operand is truthy, return true immediately
        if (operandValue) {
          return { value: true }
        }
      }
    }

    // All operands are falsy
    return { value: false }
  }

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const operands = this.node.properties.operands

    // Empty operands array returns false (no truthy values)
    if (operands.length === 0) {
      return { value: false }
    }

    // Evaluate all operands with short-circuit evaluation
    for (const operand of operands) {
      // eslint-disable-next-line no-await-in-loop
      const operandValue = await evaluateOperand(operand, context, invoker)

      // Only check truthiness if operand evaluation succeeded
      if (operandValue !== undefined) {
        // Short-circuit: if any operand is truthy, return true immediately
        if (operandValue) {
          return { value: true }
        }
      }
    }

    // All operands are falsy
    return { value: false }
  }
}
