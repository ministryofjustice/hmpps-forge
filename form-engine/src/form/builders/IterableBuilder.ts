import {
  ConditionFunctionExpr,
  FilterIteratorConfig,
  FindIteratorConfig,
  IterateExpr,
  IteratorConfig,
  MapIteratorConfig,
  PipelineExpr,
  PredicateTestExpr,
  ReferenceExpr,
  TransformerFunctionExpr,
  ValueExpr,
} from '../types/expressions.type'
import { ExpressionType, IteratorType, LogicType } from '../types/enums'
import { ExpressionBuilder } from './ExpressionBuilder'

/**
 * Split a key string into path segments.
 * 'user.name' -> ['user', 'name']
 * 'simple' -> ['simple']
 */
const splitKey = (key: string): string[] => (key.includes('.') ? key.split('.') : [key])

/**
 * Immutable builder for chainable iterate expressions.
 *
 * Created by .each() on ReferenceBuilder or ExpressionBuilder.
 * Supports chaining: .each().each().pipe()
 *
 * Enables fluent API patterns like:
 * - Data('items').each(Iterator.Map({ ... }))
 * - Data('items').each(Iterator.Filter(...)).each(Iterator.Map(...))
 * - Data('items').each(Iterator.Map({ ... })).pipe(Transformer.Array.Slice(0, 10))
 *
 * Key design decisions:
 * - Immutable: Each method returns a NEW instance
 * - Chainable: Multiple .each() calls compose iterators
 * - Escapable: .pipe() exits iteration mode to operate on the result array
 */
export class IterableBuilder {
  private readonly expression: IterateExpr

  private readonly negated: boolean

  private constructor(expr: IterateExpr, negate: boolean) {
    this.expression = expr
    this.negated = negate
  }

  /**
   * Create an iterable builder from a source and iterator.
   */
  static create(input: ValueExpr, iterator: IteratorConfig): IterableBuilder {
    return new IterableBuilder(
      {
        type: ExpressionType.ITERATE,
        input,
        iterator,
      },
      false,
    )
  }

  /**
   * Get the underlying expression.
   */
  get expr(): IterateExpr {
    return this.expression
  }

  /**
   * Build the final expression.
   * Called automatically by finaliseBuilders().
   */
  build(): IterateExpr {
    return this.expression
  }

  /**
   * Chain a Find iterator.
   * Returns an ExpressionBuilder since Find returns a single item, not an array.
   *
   * @example
   * Data('items')
   *   .each(Iterator.Filter(...))
   *   .each(Iterator.Find(...))
   *   .path('name')  // Navigate into the found item
   */
  each(iterator: FindIteratorConfig): ExpressionBuilder<ReferenceExpr>

  /**
   * Chain a Map or Filter iterator.
   * Returns an IterableBuilder that can chain more .each() calls.
   *
   * @example
   * Data('items')
   *   .each(Iterator.Filter(Item().path('active').match(Condition.IsTrue())))
   *   .each(Iterator.Map({ label: Item().path('name') }))
   */
  each(iterator: MapIteratorConfig | FilterIteratorConfig): IterableBuilder

  /**
   * Chain another iterator operation.
   */
  each(iterator: IteratorConfig): IterableBuilder | ExpressionBuilder<ReferenceExpr> {
    if (iterator.type === IteratorType.FIND) {
      // Find returns a single item - wrap in a reference with empty path
      // so .path() works naturally
      const iterateExpr: IterateExpr = {
        type: ExpressionType.ITERATE,
        input: this.expression,
        iterator,
      }
      const referenceExpr: ReferenceExpr = {
        type: ExpressionType.REFERENCE,
        base: iterateExpr,
        path: [],
      }

      return ExpressionBuilder.from(referenceExpr)
    }

    return IterableBuilder.create(this.expression, iterator)
  }

  /**
   * Transform the output array through a pipeline.
   * Exits iteration mode - operates on the whole result array.
   *
   * @example
   * Data('items')
   *   .each(Iterator.Map(Item().path('name')))
   *   .pipe(Transformer.Array.Slice(0, 10))
   */
  pipe(...steps: TransformerFunctionExpr[]): ExpressionBuilder<PipelineExpr> {
    return ExpressionBuilder.pipeline(this.expression, steps)
  }

  /**
   * Navigate into a property of the iteration result.
   * Useful after Iterator.Find() to extract a specific property from the found item.
   *
   * Creates a ReferenceExpr with the iterate expression as its base,
   * which evaluates the iteration first and then navigates into the result.
   *
   * @param key - Property path to navigate into (supports dot notation)
   * @returns ExpressionBuilder wrapping a ReferenceExpr
   *
   * @example
   * // Find an item and get its 'goals' property
   * Literal(areasOfNeed)
   *   .each(Iterator.Find(Item().path('slug').match(Condition.Equals(Params('area')))))
   *   .path('goals')
   *
   * @example
   * // Nested path navigation
   * Data('users')
   *   .each(Iterator.Find(...))
   *   .path('profile.settings')
   */
  path(key: string): ExpressionBuilder<ReferenceExpr> {
    const referenceExpr: ReferenceExpr = {
      type: ExpressionType.REFERENCE,
      base: this.expression,
      path: splitKey(key),
    }

    return ExpressionBuilder.from(referenceExpr)
  }

  /**
   * Test the output array against a condition.
   * Terminal operation - returns a plain PredicateTestExpr.
   *
   * @example
   * Data('items')
   *   .each(Iterator.Filter(...))
   *   .match(Condition.Array.IsEmpty())
   */
  match(condition: ConditionFunctionExpr<any>): PredicateTestExpr {
    return {
      type: LogicType.TEST,
      subject: this.expression,
      negate: this.negated,
      condition,
    }
  }

  /**
   * Negate the next condition test.
   * Returns a new builder with toggled negation.
   *
   * @example
   * Data('items')
   *   .each(Iterator.Filter(...))
   *   .not.match(Condition.Array.IsEmpty())
   */
  get not(): IterableBuilder {
    return new IterableBuilder(this.expression, !this.negated)
  }
}
