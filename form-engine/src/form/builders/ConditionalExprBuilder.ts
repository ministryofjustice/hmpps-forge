import { ConditionalExpr, PredicateExpr, PredicateTestExpr, ValueExpr } from '../types/expressions.type'

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
      type: 'conditional',
      predicate: this.predicate,
      thenValue: this.thenValue,
      elseValue: this.elseValue,
    }
  }
}

/**
 * Creates a conditional expression builder with the given predicate.
 * @param predicate - The condition to evaluate
 * @returns A ConditionalExprBuilder for fluent conditional building
 * @example
 * when(Answer('age').match(Condition.GreaterThan(18)))
 *   .then('adult')
 *   .else('child')
 */
export const when = (predicate: PredicateExpr | PredicateTestExpr): ConditionalExprBuilder => {
  return new ConditionalExprBuilder(predicate)
}
