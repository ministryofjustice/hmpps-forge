import {
  ConditionBranchExpr,
  ConditionFunctionExpr,
  FilterIteratorConfig,
  FindIteratorConfig,
  MapIteratorConfig,
  PredicateTestExpr,
  ResolvableExpression,
  ResolvableValue,
  TransformerFunctionExpr,
} from '../types/expressions.type'

/**
 * A value that can be returned from a conditional or match branch.
 * Can be a literal string or a value expression.
 */
export type BranchValue = string | ResolvableValue

/**
 * Public interface for a negated chain position, reached via `.not`.
 * Negation only applies to a condition test, so the only continuations
 * are `.match()` and a further `.not` to toggle the negation back.
 */
export interface ChainableNegation {
  /**
   * Test the value against a condition, negated.
   */
  match(condition: ConditionFunctionExpr<any>): PredicateTestExpr

  /**
   * Toggle the negation back off.
   */
  readonly not: ChainableNegation
}

/**
 * Public interface for chainable iterable expressions.
 * Created by .each(Iterator.Map/Filter) on references or expressions.
 */
export interface ChainableIterable extends ResolvableExpression {
  /**
   * Chain a Find iterator.
   * Returns a ChainableExpr since Find returns a single item, not an array.
   */
  each(iterator: FindIteratorConfig): ChainableExpr

  /**
   * Chain a Map or Filter iterator.
   */
  each(iterator: MapIteratorConfig | FilterIteratorConfig): ChainableIterable

  /**
   * Navigate into a property of the iteration result.
   * Useful after Iterator.Find() to extract a specific property from the found item.
   */
  path(key: string): ChainableExpr

  /**
   * Transform the output array through a pipeline.
   */
  pipe(...steps: TransformerFunctionExpr[]): ChainableExpr

  /**
   * Test the output array against a condition.
   */
  match(condition: ConditionFunctionExpr<any>): PredicateTestExpr

  /**
   * Negate the next condition test.
   */
  readonly not: ChainableNegation
}

/**
 * Public interface for chainable value expressions.
 * Only exposes the fluent API methods - internal methods like build() are hidden.
 */
export interface ChainableExpr extends ResolvableExpression {
  /**
   * Navigate into a property of the expression result.
   * Creates a reference with this expression as its base.
   */
  path(key: string): ChainableExpr

  /**
   * Transform the value through a pipeline of transformers.
   */
  pipe(...steps: TransformerFunctionExpr[]): ChainableExpr

  /**
   * Enter per-item iteration mode with a Find iterator.
   * Returns a ChainableExpr since Find returns a single item, not an array.
   */
  each(iterator: FindIteratorConfig): ChainableExpr

  /**
   * Enter per-item iteration mode with a Map or Filter iterator.
   */
  each(iterator: MapIteratorConfig | FilterIteratorConfig): ChainableIterable

  /**
   * Test the value against a condition.
   */
  match(condition: ConditionFunctionExpr<any>): PredicateTestExpr

  /**
   * Negate the next condition test.
   */
  readonly not: ChainableNegation
}

/**
 * Public interface for chainable reference expressions.
 * Extends ChainableExpr with path navigation.
 */
export interface ChainableRef extends ResolvableExpression {
  /**
   * Navigate to a nested property.
   * Supports dot notation: .path('user.address.city')
   */
  path(key: string): ChainableRef

  /**
   * Transform the value through a pipeline of transformers.
   */
  pipe(...steps: TransformerFunctionExpr[]): ChainableExpr

  /**
   * Enter per-item iteration mode with a Find iterator.
   * Returns a ChainableExpr since Find returns a single item.
   */
  each(iterator: FindIteratorConfig): ChainableExpr

  /**
   * Enter per-item iteration mode with a Map or Filter iterator.
   */
  each(iterator: MapIteratorConfig | FilterIteratorConfig): ChainableIterable

  /**
   * Test the value against a condition.
   */
  match(condition: ConditionFunctionExpr<any>): PredicateTestExpr

  /**
   * Negate the next condition test.
   */
  readonly not: ChainableNegation
}

/**
 * Public interface for conditional expressions, returned by when() and Conditional().
 * The chain continues with .then() and .else(); the finished conditional is
 * assignable anywhere a Resolvable* value is accepted.
 */
export interface ChainableConditional {
  /**
   * Sets the value to return when the predicate evaluates to true.
   */
  then(value: BranchValue): ChainableConditional

  /**
   * Sets the value to return when the predicate evaluates to false.
   */
  else(value: BranchValue): ChainableConditional
}

/**
 * Public interface for match expressions, returned by match().
 * The chain continues with .branch() and .otherwise(); the finished match is
 * assignable anywhere a Resolvable* value is accepted.
 */
export interface ChainableMatch {
  /**
   * Adds a branch: when the condition matches the subject, the value is returned.
   */
  branch(condition: ConditionBranchExpr, value: BranchValue): ChainableMatch

  /**
   * Sets the fallback value when no branch matches.
   */
  otherwise(value: BranchValue): ChainableMatch
}

/**
 * Public interface for generator expressions, returned by registered
 * generator functions (e.g. Generator.Date.Now()).
 */
export interface ChainableGenerator extends ResolvableExpression {
  /**
   * Transform the generated value through a pipeline of transformers.
   */
  pipe(...steps: TransformerFunctionExpr[]): ChainableExpr

  /**
   * Test the generated value against a condition.
   */
  match(condition: ConditionFunctionExpr<any>): PredicateTestExpr

  /**
   * Negate the next condition test.
   */
  readonly not: ChainableNegation
}

/**
 * Public interface for scoped reference builders (Item()).
 */
export interface ChainableScopedRef extends ResolvableExpression {
  /**
   * Navigate to the parent scope in nested collections.
   */
  readonly parent: ChainableScopedRef

  /**
   * Get a sub-property of the collection item.
   * Supports dot notation: .path('user.address.city')
   */
  path(key: string): ChainableRef

  /**
   * Get the full value of the collection item.
   */
  value(): ChainableRef

  /**
   * Get the key when iterating over an object.
   * Only available when iterating over object entries (not arrays).
   */
  key(): ChainableRef
}

/**
 * Public interface for loop metadata references (Loop).
 */
export interface ChainableLoopRef extends ResolvableExpression {
  /**
   * Navigate to the parent loop in nested collections.
   */
  readonly Parent: ChainableLoopRef

  /**
   * Get the current iteration position, 1-based.
   */
  Index(): ChainableRef

  /**
   * Get the current iteration index, 0-based.
   */
  Index0(): ChainableRef

  /**
   * Get the reverse iteration position, 1-based.
   */
  RevIndex(): ChainableRef

  /**
   * Get the reverse iteration index, 0-based.
   */
  RevIndex0(): ChainableRef

  /**
   * Check whether this is the first iteration.
   */
  First(): ChainableRef

  /**
   * Check whether this is the last iteration.
   */
  Last(): ChainableRef

  /**
   * Get the total number of items in the iteration.
   */
  Length(): ChainableRef
}
