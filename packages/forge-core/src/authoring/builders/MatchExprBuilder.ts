import { ConditionBranchExpr, MatchExpr, ResolvableValue } from '../types/expressions.type'
import { ExpressionType } from '../types/enums'
import { BranchValue } from './ConditionalExprBuilder'

/**
 * Fluent builder for creating match expressions.
 * Provides a flat alternative to deeply nested when().then().else() chains.
 * Branch conditions may be a single condition or a combinator tree of them,
 * with the subject applied to every condition leaf.
 */
export class MatchExprBuilder {
  private readonly subject: ResolvableValue

  private readonly branches: Array<{ condition: ConditionBranchExpr; value: BranchValue }> = []

  private otherwiseValue?: BranchValue

  constructor(subject: ResolvableValue) {
    this.subject = subject
  }

  /**
   * Adds a branch to the match expression.
   * @param condition - The condition, or combinator tree of conditions, to test against the subject
   * @param value - The value to return when this condition matches
   * @returns This builder for method chaining
   */
  branch(condition: ConditionBranchExpr, value: BranchValue): this {
    this.branches.push({ condition, value })

    return this
  }

  /**
   * Sets the fallback value when no branch matches.
   * @param value - The value to return when no branch condition matches
   * @returns This builder for method chaining
   */
  otherwise(value: BranchValue): this {
    this.otherwiseValue = value

    return this
  }

  /**
   * Builds the final match expression.
   * Note: This is private to hide its interface from the user, finaliseBuilders calls this
   */

  private build(): MatchExpr {
    return {
      type: ExpressionType.MATCH,
      subject: this.subject,
      branches: this.branches.map(b => ({
        condition: b.condition,
        value: b.value,
      })),
      ...(this.otherwiseValue !== undefined && { otherwise: this.otherwiseValue }),
    }
  }
}

/**
 * Creates a match expression builder for the given subject.
 * Use this to create switch-like conditional logic with multiple branches.
 * Each branch takes a single condition or a combinator tree built with
 * and()/or()/xor()/not(); the subject is applied to every condition leaf.
 *
 * @param subject - The value to match against
 * @returns A MatchExprBuilder for fluent branch building
 *
 * @example
 * match(Item().path('status'))
 *   .branch(Condition.Equals('NOT_STARTED'), 'Not started')
 *   .branch(Condition.Equals('IN_PROGRESS'), 'In progress')
 *   .branch(or(Condition.Equals('COMPLETED'), Condition.Equals('APPROVED')), 'Completed')
 *   .otherwise('Unknown')
 */
export const match = (subject: BranchValue): MatchExprBuilder => {
  return new MatchExprBuilder(subject)
}
