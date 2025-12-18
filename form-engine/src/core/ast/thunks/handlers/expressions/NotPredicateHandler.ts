import { NodeId } from '@form-engine/core/types/engine.type'
import { NotPredicateASTNode } from '@form-engine/core/types/expressions.type'
import {
  HybridThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { evaluateOperand } from '@form-engine/core/ast/thunks/handlers/utils/evaluation'
import { isASTNode } from '@form-engine/core/typeguards/nodes'

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
 *
 * Synchronous when operand is a primitive or sync node.
 * Asynchronous when operand is an async node.
 */
export default class NotPredicateHandler implements HybridThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: NotPredicateASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const operand = this.node.properties.operand

    // Check if operand is an async AST node
    if (isASTNode(operand)) {
      const handler = deps.thunkHandlerRegistry.get(operand.id)

      this.isAsync = handler?.isAsync ?? true
    } else {
      // Primitive operand - always sync
      this.isAsync = false
    }
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult {
    const operand = this.node.properties.operand

    let operandValue: unknown

    if (isASTNode(operand)) {
      const result = invoker.invokeSync(operand.id, context)

      operandValue = result.error ? undefined : result.value
    } else {
      operandValue = operand
    }

    // Return negation of operand's truthiness
    // Failed evaluations (undefined) are treated as falsy, so NOT returns true
    return { value: !operandValue }
  }

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const operand = this.node.properties.operand

    // Evaluate the operand
    const operandValue = await evaluateOperand(operand, context, invoker)

    // Return negation of operand's truthiness
    // Failed evaluations (undefined) are treated as falsy, so NOT returns true
    return { value: !operandValue }
  }
}
