import { ConditionalExpr, PredicateExpr, PredicateTestExpr, ValueExpr } from '../types/expressions.type'
import { LogicType } from '../types/enums'

/**
 * Represents a value that can be returned from a conditional branch.
 * Can be a literal string or a value expression.
 */
export type BranchValue = string | ValueExpr

/**
 * Fluent builder for creating conditional expressions.
 * Allows chaining of then/else branches after a predicate condition.
 */
export class ConditionalExprBuilder {
  private readonly predicate: PredicateExpr

  private thenValue: BranchValue = true

  private elseValue: BranchValue = false

  constructor(predicate: PredicateExpr) {
    this.predicate = predicate
  }

  /**
   * Sets the value to return when the predicate evaluates to true.
   * @param value - The value or expression to return
   * @returns This builder for method chaining
   */
  then(value: BranchValue): this {
    this.thenValue = value
    return this
  }

  /**
   * Sets the value to return when the predicate evaluates to false.
   * @param value - The value or expression to return
   * @returns This builder for method chaining
   */
  else(value: BranchValue): this {
    this.elseValue = value
    return this
  }

  /**
   * Builds the final conditional expression.
   * Note: This is private to hide its interface from the user, finaliseBuilders calls this
   */
  private build(): ConditionalExpr {
    return {
      type: LogicType.CONDITIONAL,
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
  const builder = new ConditionalExprBuilder(options.when)

  builder.then(options.then)

  if (options.else !== undefined) {
    builder.else(options.else)
  }

  return builder
}
