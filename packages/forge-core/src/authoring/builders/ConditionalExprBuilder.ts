import { ConditionalExpr, PredicateExpr, PredicateTestExpr, ResolvableValue } from '../types/expressions.type'
import { ExpressionType } from '../types/enums'

/**
 * Represents a value that can be returned from a conditional branch.
 * Can be a literal string or a value expression.
 */
export type BranchValue = string | ResolvableValue

/**
 * Immutable fluent builder for creating conditional expressions.
 * Allows chaining of then/else branches after a predicate condition.
 * Each method returns a NEW instance, so partially-built conditionals
 * can be safely reused and forked.
 */
export class ConditionalExprBuilder {
  private readonly predicate: PredicateExpr

  private readonly thenValue: BranchValue

  private readonly elseValue: BranchValue

  constructor(predicate: PredicateExpr, thenValue: BranchValue = true, elseValue: BranchValue = false) {
    this.predicate = predicate
    this.thenValue = thenValue
    this.elseValue = elseValue
  }

  /**
   * Sets the value to return when the predicate evaluates to true.
   * @param value - The value or expression to return
   * @returns A new builder with the then branch set
   */
  then(value: BranchValue): ConditionalExprBuilder {
    return new ConditionalExprBuilder(this.predicate, value, this.elseValue)
  }

  /**
   * Sets the value to return when the predicate evaluates to false.
   * @param value - The value or expression to return
   * @returns A new builder with the else branch set
   */
  else(value: BranchValue): ConditionalExprBuilder {
    return new ConditionalExprBuilder(this.predicate, this.thenValue, value)
  }

  /**
   * Builds the final conditional expression.
   * Note: This is private to hide its interface from the user, finaliseBuilders calls this
   */

  private build(): ConditionalExpr {
    return {
      type: ExpressionType.CONDITIONAL,
      predicate: this.predicate,
      thenValue: this.thenValue,
      elseValue: this.elseValue,
    }
  }
}

/**
 * Creates a conditional expression builder with the given predicate.
 * Use this for fluent chained conditional building.
 *
 * @param predicate - The condition to evaluate
 * @returns A ConditionalExprBuilder for fluent conditional building
 *
 * @example
 * when(Answer('age').match(Condition.GreaterThan(18)))
 *   .then('adult')
 *   .else('child')
 */
export const when = (predicate: PredicateExpr | PredicateTestExpr): ConditionalExprBuilder => {
  return new ConditionalExprBuilder(predicate)
}

/**
 * Options for creating a conditional expression using object syntax.
 */
export interface ConditionalOptions {
  /** The predicate condition to evaluate */
  when: PredicateExpr | PredicateTestExpr
  /** Value to return when predicate is true */
  then: BranchValue
  /** Value to return when predicate is false (optional, defaults to undefined) */
  else?: BranchValue
}

/**
 * Creates a conditional expression using object syntax.
 * Alternative to the fluent `when().then().else()` builder.
 *
 * @param options - Object with when, then, and optional else properties
 * @returns A ConditionalExprBuilder that will be finalised during form processing
 *
 * @example
 * // Basic usage
 * Conditional({
 *   when: Answer('country').match(Condition.Equals('UK')),
 *   then: 'Postcode',
 *   else: 'ZIP Code',
 * })
 *
 * // Without else (returns undefined when false)
 * Conditional({
 *   when: Answer('isPremium').match(Condition.Equals(true)),
 *   then: 'Premium Support',
 * })
 *
 * // Nested conditionals
 * Conditional({
 *   when: Answer('tier').match(Condition.Equals('premium')),
 *   then: 'Premium',
 *   else: Conditional({
 *     when: Answer('tier').match(Condition.Equals('standard')),
 *     then: 'Standard',
 *     else: 'Basic',
 *   }),
 * })
 */
export const Conditional = (options: ConditionalOptions): ConditionalExprBuilder => {
  const builder = new ConditionalExprBuilder(options.when).then(options.then)

  return options.else !== undefined ? builder.else(options.else) : builder
}
