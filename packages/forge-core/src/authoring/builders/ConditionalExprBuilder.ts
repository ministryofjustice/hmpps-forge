import { ConditionalExpr, PredicateExpr, PredicateTestExpr } from '../types/expressions.type'
import { ExpressionType } from '../types/enums'
import { BranchValue, ChainableConditional } from './types'
import { captureCallsite, stampCallsite } from './utils/captureCallsite'

/**
 * Immutable fluent builder for creating conditional expressions.
 * Allows chaining of then/else branches after a predicate condition.
 * Each method returns a NEW instance, so partially-built conditionals
 * can be safely reused and forked.
 *
 * @internal Exposed to authors via the ChainableConditional interface.
 */
export class ConditionalExprBuilder implements ChainableConditional {
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
 * @returns A chainable conditional for fluent then/else building
 *
 * @example
 * when(Answer('age').match(Condition.GreaterThan(18)))
 *   .then('adult')
 *   .else('child')
 */
export const when = (predicate: PredicateExpr | PredicateTestExpr): ChainableConditional => {
  const builder = new ConditionalExprBuilder(predicate)
  stampCallsite(builder, captureCallsite(when))
  return builder
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
 * @returns A chainable conditional that will be finalised during form processing
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
export const Conditional = (options: ConditionalOptions): ChainableConditional => {
  const builder = new ConditionalExprBuilder(options.when).then(options.then)
  const result = options.else !== undefined ? builder.else(options.else) : builder
  stampCallsite(result, captureCallsite(Conditional))
  return result
}
