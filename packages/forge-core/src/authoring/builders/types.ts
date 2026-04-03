import {
  ConditionFunctionExpr,
  FilterIteratorConfig,
  FindIteratorConfig,
  MapIteratorConfig,
  PipelineExpr,
  PredicateTestExpr,
  ReferenceExpr,
  TransformerFunctionExpr,
  ValueExpr,
} from '../types/expressions.type'

/**
 * Public interface for chainable iterable expressions.
 * Created by .each(Iterator.Map/Filter) on references or expressions.
 */
export interface ChainableIterable {
  /**
   * Chain a Find iterator.
   * Returns a ChainableExpr since Find returns a single item, not an array.
   */
  each(iterator: FindIteratorConfig): ChainableExpr<ReferenceExpr>

  /**
   * Chain a Map or Filter iterator.
   */
  each(iterator: MapIteratorConfig | FilterIteratorConfig): ChainableIterable

  /**
   * Navigate into a property of the iteration result.
   * Useful after Iterator.Find() to extract a specific property from the found item.
   */
  path(key: string): ChainableExpr<ReferenceExpr>

  /**
   * Transform the output array through a pipeline.
   */
  pipe(...steps: TransformerFunctionExpr[]): ChainableExpr<PipelineExpr>

  /**
   * Test the output array against a condition.
   */
  match(condition: ConditionFunctionExpr<any>): PredicateTestExpr

  /**
   * Negate the next condition test.
   */
  readonly not: ChainableIterable
}

/**
 * Public interface for chainable value expressions.
 * Only exposes the fluent API methods - internal methods like build() are hidden.
 */
export interface ChainableExpr<T extends ValueExpr> {
  /**
   * Navigate into a property of the expression result.
   * Creates a reference with this expression as its base.
   */
  path(key: string): ChainableExpr<ReferenceExpr>

  /**
   * Transform the value through a pipeline of transformers.
   */
  pipe(...steps: TransformerFunctionExpr[]): ChainableExpr<PipelineExpr>

  /**
   * Enter per-item iteration mode with a Find iterator.
   * Returns a ChainableExpr since Find returns a single item, not an array.
   */
  each(iterator: FindIteratorConfig): ChainableExpr<ReferenceExpr>

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
  readonly not: ChainableExpr<T>
}

/**
 * Public interface for chainable reference expressions.
 * Extends ChainableExpr with path navigation.
 */
export interface ChainableRef {
  /**
   * Navigate to a nested property.
   * Supports dot notation: .path('user.address.city')
   */
  path(key: string): ChainableRef

  /**
   * Transform the value through a pipeline of transformers.
   */
  pipe(...steps: TransformerFunctionExpr[]): ChainableExpr<PipelineExpr>

  /**
   * Enter per-item iteration mode with a Find iterator.
   * Returns a ChainableExpr since Find returns a single item.
   */
  each(iterator: FindIteratorConfig): ChainableExpr<ReferenceExpr>

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
  readonly not: ChainableRef
}

/**
 * Public interface for scoped reference builders (Item()).
 */
export interface ChainableScopedRef {
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
   * Get the current iteration index.
   */
  index(): ChainableRef

  /**
   * Get the key when iterating over an object.
   * Only available when iterating over object entries (not arrays).
   */
  key(): ChainableRef
}
