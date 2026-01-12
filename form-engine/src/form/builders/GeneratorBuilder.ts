import { FunctionType, PredicateType } from '../types/enums'
import {
  ConditionFunctionExpr,
  GeneratorFunctionExpr,
  PipelineExpr,
  PredicateTestExpr,
  TransformerFunctionExpr,
  ValueExpr,
} from '../types/expressions.type'
import { ExpressionBuilder } from './ExpressionBuilder'

/**
 * Immutable builder for creating generator function expressions.
 *
 * Generators produce values without requiring input, unlike conditions and transformers.
 * They can be used standalone, chained with transformers via pipelines, or tested with conditions.
 *
 * @example
 * // Standalone generator
 * Generator.Date.Now()
 *
 * @example
 * // Generator with pipeline
 * Generator.Date.Now().pipe(Transformer.Date.AddDays(7))
 *
 * @example
 * // Generator with condition
 * Generator.Date.Now().match(Condition.Date.IsFutureDate())
 *
 * @template A - The argument types for the generator function
 */
export class GeneratorBuilder<A extends ValueExpr[]> {
  private readonly expression: GeneratorFunctionExpr<A>

  private readonly negated: boolean

  private constructor(expr: GeneratorFunctionExpr<A>, negate: boolean = false) {
    this.expression = expr
    this.negated = negate
  }

  /**
   * Create a new GeneratorBuilder with the given function name and arguments.
   *
   * @param name - The name of the generator function (must be registered)
   * @param args - Arguments to pass to the generator function
   */
  static create<A extends ValueExpr[]>(name: string, args: A): GeneratorBuilder<A> {
    return new GeneratorBuilder(
      {
        type: FunctionType.GENERATOR,
        name,
        arguments: args,
      },
      false,
    )
  }

  /**
   * Get the underlying generator expression.
   */
  get expr(): GeneratorFunctionExpr<A> {
    return this.expression
  }

  /**
   * Build the final generator function expression.
   * Called automatically by finaliseBuilders().
   */
  build(): GeneratorFunctionExpr<A> {
    return this.expression
  }

  /**
   * Transform the generated value through a pipeline of transformers.
   * Creates a PipelineExpr with this generator as the input.
   *
   * @param steps - Transformer functions to apply sequentially
   * @returns An ExpressionBuilder wrapping the pipeline
   *
   * @example
   * Generator.Date.Now().pipe(
   *   Transformer.Date.AddDays(7),
   *   Transformer.Date.Format('YYYY-MM-DD')
   * )
   */
  pipe(...steps: TransformerFunctionExpr[]): ExpressionBuilder<PipelineExpr> {
    return ExpressionBuilder.pipeline(this.expression, steps)
  }

  /**
   * Test the generated value against a condition.
   * Terminal operation - returns a plain PredicateTestExpr.
   *
   * @example
   * Generator.Date.Now().match(Condition.Date.IsFutureDate())
   */
  match(condition: ConditionFunctionExpr<any>): PredicateTestExpr {
    return {
      type: PredicateType.TEST,
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
   * Generator.Date.Now().not.match(Condition.Date.IsPast())
   */
  get not(): GeneratorBuilder<A> {
    return new GeneratorBuilder(this.expression, !this.negated)
  }
}
