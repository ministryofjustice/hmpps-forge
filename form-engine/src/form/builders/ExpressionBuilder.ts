import {
  ConditionFunctionExpr,
  IteratorConfig,
  PipelineExpr,
  PredicateTestExpr,
  TransformerFunctionExpr,
  ValueExpr,
} from '../types/expressions.type'
import { ExpressionType, LogicType } from '../types/enums'
import { IterableBuilder } from './IterableBuilder'

/**
 * Immutable builder for creating chainable value expressions.
 *
 * Enables fluent API patterns like:
 * - Answer('email').pipe(Transformer.String.Trim).match(Condition.IsRequired())
 * - Self().not.match(Condition.String.IsEmpty())
 * - Answer('quantity').pipe(Transformer.Number.Parse).not.match(Condition.Number.LessThan(0))
 *
 * Key design decisions:
 * - Immutable: Each method returns a NEW instance
 * - Type-safe: Full TypeScript inference throughout chains
 * - Buildable: Implements build() for automatic finalization via finaliseBuilders()
 */
export class ExpressionBuilder<T extends ValueExpr> {
  private readonly expression: T

  private readonly negate: boolean

  private constructor(expr: T, negate: boolean) {
    this.expression = expr
    this.negate = negate
  }

  /**
   * Create a builder from any value expression.
   */
  static from<E extends ValueExpr>(expr: E): ExpressionBuilder<E> {
    return new ExpressionBuilder(expr, false)
  }

  /**
   * Create a builder wrapping a pipeline expression.
   */
  static pipeline(input: ValueExpr, steps: TransformerFunctionExpr[]): ExpressionBuilder<PipelineExpr> {
    return new ExpressionBuilder(
      {
        type: ExpressionType.PIPELINE,
        input,
        steps,
      },
      false,
    )
  }

  /**
   * Get the underlying expression.
   */
  get expr(): T {
    return this.expression
  }

  /**
   * Build the final expression.
   * Called automatically by finaliseBuilders().
   */
  build(): T {
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
   * Enter per-item iteration mode with an iterator.
   * Returns an IterableBuilder that can chain more .each() calls or exit via .pipe().
   *
   * @example
   * Literal(someArray).each(Iterator.Map(Item().path('name')))
   */
  each(iterator: IteratorConfig): IterableBuilder {
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
    return {
      type: LogicType.TEST,
      subject: this.expression,
      negate: this.negate,
      condition,
    }
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
    return new ExpressionBuilder(this.expression, !this.negate)
  }
}
