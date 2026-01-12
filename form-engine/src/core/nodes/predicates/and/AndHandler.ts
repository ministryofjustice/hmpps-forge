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
import { AndPredicateASTNode } from '@form-engine/core/types/predicates.type'

/**
 * Handler for AND predicate expression nodes
 *
 * Evaluates an AND predicate by:
 * 1. Evaluating all operands in the operands array
 * 2. Returning true if ALL operands are truthy
 * 3. Returning false if ANY operand is falsy
 *
 * Operands can be:
 * - AST nodes (evaluated dynamically)
 * - Primitive values (checked for truthiness as-is)
 *
 * Short-circuit evaluation: Stops evaluating as soon as a falsy operand is found
 *
 * Synchronous when all operands are primitives or sync nodes.
 * Asynchronous when any operand is an async node.
 */
export default class AndHandler implements HybridThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: AndPredicateASTNode,
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

    // Empty operands array returns true (vacuous truth)
    if (operands.length === 0) {
      return { value: true }
    }

    // Evaluate all operands with short-circuit evaluation
    for (const operand of operands) {
      let operandValue: unknown

      if (isASTNode(operand)) {
        const result = invoker.invokeSync(operand.id, context)

        if (result.error) {
          return { value: false }
        }

        operandValue = result.value
      } else {
        operandValue = operand
      }

      // If operand evaluation failed, return false
      if (operandValue === undefined) {
        return { value: false }
      }

      // Short-circuit: if any operand is falsy, return false immediately
      if (!operandValue) {
        return { value: false }
      }
    }

    // All operands are truthy
    return { value: true }
  }

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const operands = this.node.properties.operands

    // Empty operands array returns true (vacuous truth)
    if (operands.length === 0) {
      return { value: true }
    }

    // Evaluate all operands with short-circuit evaluation
    for (const operand of operands) {
      // eslint-disable-next-line no-await-in-loop
      const operandValue = await evaluateOperand(operand, context, invoker)

      // If operand evaluation failed, return false
      if (operandValue === undefined) {
        return { value: false }
      }

      // Short-circuit: if any operand is falsy, return false immediately
      if (!operandValue) {
        return { value: false }
      }
    }

    // All operands are truthy
    return { value: true }
  }
}
