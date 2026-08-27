/* eslint-disable max-classes-per-file -- ChainedValueBuilder, ExpressionBuilder, and
   IterableBuilder are mutually recursive; separate modules would make class
   initialisation depend on module evaluation order. */
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
  ResolvableValue,
} from '../types/expressions.type'
import { ExpressionType, IteratorType, PredicateType, BuilderType } from '../types/enums'
import { captureCallsite, stampCallsite } from './utils/captureCallsite'
import { splitKey } from './utils/splitKey'

/**
 * Shared behaviour for the immutable chained-value builders: holds the wrapped
 * expression and pending negation, and owns the chain operations whose
 * behaviour is identical across builders.
 *
 * Lives in this file because `pipe()`/`each()` construct ExpressionBuilder and
 * IterableBuilder, which extend this class - splitting the three across
 * modules would make class initialisation depend on module evaluation order.
 */
export abstract class ChainedValueBuilder<TExpr extends ResolvableValue> {
  protected constructor(
    protected readonly expression: TExpr,
    protected readonly negated: boolean,
  ) {}

  /**
   * Get the underlying expression.
   */
  get expr(): TExpr {
    return this.expression
  }

  /**
   * Build the final expression.
   * Called automatically by finaliseBuilders().
   */
  build(): TExpr {
    return this.expression
  }

  /**
   * Transform the value through a pipeline of transformers.
   * Each call creates a nested pipeline (input is the current expression).
   *
   * @example
   * Answer('email').pipe(
   *   Transformer.String.Trim,
   *   Transformer.String.ToLowerCase,
   * )
   */
  pipe(...steps: TransformerFunctionExpr[]): ExpressionBuilder<PipelineExpr> {
    return ExpressionBuilder.pipeline(this.expression, steps)
  }

  /**
   * Enter per-item iteration mode with a Find iterator.
   * Returns an ExpressionBuilder since Find returns a single item, not an array.
   *
   * @example
   * Data('users').each(Iterator.Find(Item().path('id').match(Condition.Equals(Params('userId')))))
   *   .path('name')  // Navigate into the found item
   */
  each(iterator: FindIteratorConfig): ExpressionBuilder<ReferenceExpr>

  /**
   * Enter per-item iteration mode with a Map or Filter iterator.
   * Returns an IterableBuilder that can chain more .each() calls or exit via .pipe().
   *
   * @example
   * Data('items').each(Iterator.Map({ label: Item().path('name') }))
   * Data('items').each(Iterator.Filter(...)).each(Iterator.Map(...))
   */
  each(iterator: MapIteratorConfig | FilterIteratorConfig): IterableBuilder

  /**
   * Enter per-item iteration mode with an iterator.
   */
  each(iterator: IteratorConfig): IterableBuilder | ExpressionBuilder<ReferenceExpr> {
    if (iterator._forge === IteratorType.FIND) {
      // Find returns a single item - wrap in a reference with empty path
      // so .path() works naturally
      const iterateExpr = {
        _forge: ExpressionType.ITERATE as const,
        input: this.expression,
        iterator,
      }
      const referenceExpr: ReferenceExpr = {
        _forge: ExpressionType.REFERENCE,
        base: iterateExpr,
        path: [],
      }

      return ExpressionBuilder.from(referenceExpr)
    }

    return IterableBuilder.create(this.expression, iterator)
  }

  /**
   * Test the value against a condition.
   * Terminal operation - returns a plain PredicateTestExpr.
   *
   * @example
   * Answer('age').match(Condition.Number.GreaterThan(18))
   * Self().not.match(Condition.IsRequired())
   */
  match(condition: ConditionFunctionExpr<any>): PredicateTestExpr {
    const predicate: PredicateTestExpr = {
      _forge: PredicateType.TEST,
      subject: this.expression,
      negate: this.negated,
      condition,
    }

    stampCallsite(predicate, captureCallsite(this.match))

    return predicate
  }
}

/**
 * Immutable builder for creating chainable value expressions.
 *
 * Enables fluent API patterns like:
 * - Answer('email').pipe(Transformer.String.Trim).match(Condition.IsRequired())
 * - Self().not.match(Condition.String.IsEmpty())
 * - Answer('quantity').pipe(Transformer.Number.Parse).not.match(Condition.Number.LessThan(0))
 *
 * @internal Exposed to authors via the ChainableExpr interface.
 */
export class ExpressionBuilder<T extends ResolvableValue> extends ChainedValueBuilder<T> {
  readonly _forge = BuilderType.CHAIN as const

  private constructor(expr: T, negate: boolean) {
    super(expr, negate)
  }

  /**
   * Create a builder from any value expression.
   */
  static from<E extends ResolvableValue>(expr: E): ExpressionBuilder<E> {
    return new ExpressionBuilder(expr, false)
  }

  /**
   * Create a builder wrapping a pipeline expression.
   */
  static pipeline(input: ResolvableValue, steps: TransformerFunctionExpr[]): ExpressionBuilder<PipelineExpr> {
    return new ExpressionBuilder(
      {
        _forge: ExpressionType.PIPELINE,
        input,
        steps,
      },
      false,
    )
  }

  /**
   * Navigate into a property of the expression result.
   * Creates a ReferenceExpr with this expression as its base.
   *
   * @param key - Property path to navigate into (supports dot notation)
   * @returns ExpressionBuilder wrapping a ReferenceExpr
   *
   * @example
   * // After a Find, navigate into the result
   * Data('users').each(Iterator.Find(...)).path('profile.name')
   */
  path(key: string): ExpressionBuilder<ReferenceExpr> {
    const referenceExpr: ReferenceExpr = {
      _forge: ExpressionType.REFERENCE,
      base: this.expression,
      path: splitKey(key),
    }

    return ExpressionBuilder.from(referenceExpr)
  }

  /**
   * Negate the next condition test.
   * Returns a new builder with toggled negation.
   *
   * @example
   * Self().not.match(Condition.IsRequired())  // negate: true
   * Self().not.not.match(Condition.IsRequired())  // negate: false (double negation)
   */
  get not(): ExpressionBuilder<T> {
    return new ExpressionBuilder(this.expression, !this.negated)
  }
}

/**
 * Immutable builder for chainable iterate expressions.
 *
 * Created by .each() on ReferenceBuilder or ExpressionBuilder.
 * Supports chaining: .each().each().pipe()
 *
 * @internal Exposed to authors via the ChainableIterable interface.
 */
export class IterableBuilder extends ChainedValueBuilder<IterateExpr> {
  readonly _forge = BuilderType.ITERABLE as const

  private constructor(expr: IterateExpr, negate: boolean) {
    super(expr, negate)
  }

  /**
   * Create an iterable builder from a source and iterator.
   */
  static create(input: ResolvableValue, iterator: IteratorConfig): IterableBuilder {
    return new IterableBuilder(
      {
        _forge: ExpressionType.ITERATE,
        input,
        iterator,
      },
      false,
    )
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
   */
  path(key: string): ExpressionBuilder<ReferenceExpr> {
    const referenceExpr: ReferenceExpr = {
      _forge: ExpressionType.REFERENCE,
      base: this.expression,
      path: splitKey(key),
    }

    return ExpressionBuilder.from(referenceExpr)
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
