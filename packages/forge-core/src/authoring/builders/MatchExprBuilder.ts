import { ConditionBranchExpr, MatchExpr, ResolvableValue } from '../types/expressions.type'
import { ExpressionType, BuilderType } from '../types/enums'
import { BranchValue, ChainableMatch } from './types'
import { captureCallsite, stampCallsite } from './utils/captureCallsite'

/**
 * Immutable fluent builder for creating match expressions.
 * Provides a flat alternative to deeply nested when().then().else() chains.
 * Branch conditions may be a single condition or a combinator tree of them,
 * with the subject applied to every condition leaf.
 * Each method returns a NEW instance, so partially-built matches
 * can be safely reused and forked.
 *
 * @internal Exposed to authors via the ChainableMatch interface.
 */
export class MatchExprBuilder implements ChainableMatch {
  readonly _forge = BuilderType.MATCH as const

  private readonly subject: ResolvableValue

  private readonly branches: ReadonlyArray<{ condition: ConditionBranchExpr; value: BranchValue }>

  private readonly otherwiseValue?: BranchValue

  constructor(
    subject: ResolvableValue,
    branches: ReadonlyArray<{ condition: ConditionBranchExpr; value: BranchValue }> = [],
    otherwiseValue?: BranchValue,
  ) {
    this.subject = subject
    this.branches = branches
    this.otherwiseValue = otherwiseValue
  }

  /**
   * Adds a branch to the match expression.
   * @param condition - The condition, or combinator tree of conditions, to test against the subject
   * @param value - The value to return when this condition matches
   * @returns A new builder with the branch appended
   */
  branch(condition: ConditionBranchExpr, value: BranchValue): MatchExprBuilder {
    return new MatchExprBuilder(this.subject, [...this.branches, { condition, value }], this.otherwiseValue)
  }

  /**
   * Sets the fallback value when no branch matches.
   * @param value - The value to return when no branch condition matches
   * @returns A new builder with the fallback set
   */
  otherwise(value: BranchValue): MatchExprBuilder {
    return new MatchExprBuilder(this.subject, this.branches, value)
  }

  /**
   * Builds the final match expression.
   * Note: This is private to hide its interface from the user, finaliseBuilders calls this
   */

  build(): MatchExpr {
    return {
      _forge: ExpressionType.MATCH,
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
 * @returns A chainable match for fluent branch building
 *
 * @example
 * match(Item().path('status'))
 *   .branch(Condition.Equals('NOT_STARTED'), 'Not started')
 *   .branch(Condition.Equals('IN_PROGRESS'), 'In progress')
 *   .branch(or(Condition.Equals('COMPLETED'), Condition.Equals('APPROVED')), 'Completed')
 *   .otherwise('Unknown')
 */
export const match = (subject: BranchValue): ChainableMatch => {
  const builder = new MatchExprBuilder(subject)
  stampCallsite(builder, captureCallsite(match))
  return builder
}
