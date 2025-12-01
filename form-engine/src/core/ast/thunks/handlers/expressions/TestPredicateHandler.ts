import { NodeId } from '@form-engine/core/types/engine.type'
import { TestPredicateASTNode } from '@form-engine/core/types/expressions.type'
import { ThunkHandler, ThunkInvocationAdapter, HandlerResult } from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { evaluateWithScope } from '@form-engine/core/ast/thunks/handlers/utils/evaluation'

/**
 * Handler for TEST predicate expression nodes
 *
 * Evaluates a TEST predicate by:
 * 1. Evaluating the subject (the value being tested)
 * 2. Pushing the subject value onto the scope stack as @value
 * 3. Evaluating the condition (typically a CONDITION function that returns boolean)
 * 4. Popping the scope after condition evaluation
 * 5. Returning the condition result (optionally negated)
 *
 * The condition function receives the subject value as its first parameter via
 * the scope mechanism - FunctionHandler reads @value from the scope.
 *
 * Example use case:
 * - subject: reference to a field value
 * - condition: a CONDITION function that checks if the field satisfies some criteria
 * - negate: false (or true to invert the result)
 *
 * Error handling: If either subject or condition evaluation fails, the test fails (returns false)
 */
export default class TestPredicateHandler implements ThunkHandler {
  constructor(
    public readonly nodeId: NodeId,
    private readonly node: TestPredicateASTNode,
  ) {}

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const { subject, condition, negate } = this.node.properties

    // Evaluate subject
    const subjectResult = await invoker.invoke(subject.id, context)

    if (subjectResult.error) {
      return { value: false }
    }

    // Evaluate condition with subject value in scope
    const conditionResult = await evaluateWithScope({ '@value': subjectResult.value }, context, () =>
      invoker.invoke(condition.id, context),
    )

    if (conditionResult.error) {
      return { value: false }
    }

    // Get the boolean result from condition and apply negation if requested
    const testResult = Boolean(conditionResult.value)

    return { value: negate ? !testResult : testResult }
  }
}
