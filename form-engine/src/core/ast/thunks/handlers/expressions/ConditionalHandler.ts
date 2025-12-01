import { NodeId } from '@form-engine/core/types/engine.type'
import { ConditionalASTNode } from '@form-engine/core/types/expressions.type'
import { ThunkHandler, ThunkInvocationAdapter, HandlerResult } from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { evaluateOperand } from '@form-engine/core/ast/thunks/handlers/utils/evaluation'

/**
 * Handler for Conditional expression nodes (if-then-else logic)
 *
 * Evaluates a conditional expression by:
 * 1. Evaluating the predicate to determine truthiness
 * 2. Returning thenValue if predicate is truthy
 * 3. Returning elseValue if predicate is falsy
 *
 * Both thenValue and elseValue can be:
 * - AST nodes (evaluated dynamically)
 * - Primitive values (returned as-is)
 * - Undefined (default if not specified)
 */
export default class ConditionalHandler implements ThunkHandler {
  constructor(
    public readonly nodeId: NodeId,
    private readonly node: ConditionalASTNode,
  ) {}

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const predicateResult = await invoker.invoke(this.node.properties.predicate.id, context)

    if (predicateResult.error) {
      return { value: undefined }
    }

    const selectedValue = predicateResult.value ? this.node.properties.thenValue : this.node.properties.elseValue

    const value = await evaluateOperand(selectedValue, context, invoker)

    return { value }
  }
}
