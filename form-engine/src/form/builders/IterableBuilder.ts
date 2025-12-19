import {
  ConditionFunctionExpr,
  IterateExpr,
  IteratorConfig,
  PipelineExpr,
  PredicateTestExpr,
  TransformerFunctionExpr,
  ValueExpr,
} from '../types/expressions.type'
import { ExpressionType, LogicType } from '../types/enums'
import { ExpressionBuilder } from './ExpressionBuilder'

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
   * Chain another iterator operation.
   * Each .each() creates a new iteration context.
   *
   * @example
   * Data('items')
   *   .each(Iterator.Filter(Item().path('active').match(Condition.IsTrue())))
   *   .each(Iterator.Map({ label: Item().path('name') }))
   */
  each(iterator: IteratorConfig): IterableBuilder {
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
