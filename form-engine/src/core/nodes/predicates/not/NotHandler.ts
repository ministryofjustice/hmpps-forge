import { NodeId } from '@form-engine/core/types/engine.type'
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
import { NotPredicateASTNode } from '@form-engine/core/types/predicates.type'

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
export default class NotHandler implements ThunkHandler {
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
    const operandValue = evaluateOperandSync(operand, context, invoker)

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
