import { FunctionCallType, BuilderType } from '../types/enums'
import { GeneratorFunctionExpr, ResolvableValue } from '../types/expressions.type'
import { ChainedValueBuilder } from './ExpressionBuilder'
import { ChainableGenerator, ChainableNegation } from './types'

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
 *
 * @internal Exposed to authors via the ChainableGenerator interface.
 */
export class GeneratorBuilder<A extends ResolvableValue[]>
  extends ChainedValueBuilder<GeneratorFunctionExpr<A>>
  implements ChainableGenerator
{
  readonly _forge = BuilderType.GENERATOR as const

  private constructor(expr: GeneratorFunctionExpr<A>, negate: boolean) {
    super(expr, negate)
  }

  /**
   * Create a new GeneratorBuilder with the given function name and arguments.
   *
   * @param name - The name of the generator function (must be registered)
   * @param args - Arguments to pass to the generator function
   */
  static create<A extends ResolvableValue[]>(name: string, args: A): GeneratorBuilder<A> {
    return new GeneratorBuilder(
      {
        _forge: FunctionCallType.GENERATOR,
        name,
        arguments: args,
      },
      false,
    )
  }

  /**
   * Negate the next condition test.
   * Returns a new builder with toggled negation.
   *
   * @example
   * Generator.Date.Now().not.match(Condition.Date.IsPast())
   */
  get not(): ChainableNegation {
    return new GeneratorBuilder(this.expression, !this.negated)
  }
}
