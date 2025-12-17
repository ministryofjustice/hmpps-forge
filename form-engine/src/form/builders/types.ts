import {
  ConditionFunctionExpr,
  PipelineExpr,
  PredicateTestExpr,
  TransformerFunctionExpr,
  ValueExpr,
} from '../types/expressions.type'

/**
 * Public interface for chainable value expressions.
 * Only exposes the fluent API methods - internal methods like build() are hidden.
 */
export interface ChainableExpr<T extends ValueExpr> {
  /**
   * Transform the value through a pipeline of transformers.
   */
  pipe(...steps: TransformerFunctionExpr[]): ChainableExpr<PipelineExpr>

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
}
