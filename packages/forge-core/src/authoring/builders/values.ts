import { ExpressionBuilder } from './ExpressionBuilder'
import { captureCallsite, stampCallsite } from './utils/captureCallsite'
import { ChainableExpr, ChainableGenerator } from './types'
import { ResolvableValue } from '../types/expressions.type'
import { ResolvableString } from '../../components/types/structures.type'
import { FormatGenerators } from '../generators/formatGenerators'

/**
 * Creates a string formatting expression with placeholder substitution.
 * Placeholders are %1, %2, etc.
 *
 * @example
 * Format('Hello %1!', Answer('name'))
 * Format('%1 %2', Answer('firstName'), Answer('lastName'))
 */
export const Format = FormatGenerators.FormatString as (
  template: ResolvableString,
  ...args: ResolvableString[]
) => ChainableGenerator

/**
 * Wraps a static/literal value to make it chainable with .pipe() and .match().
 *
 * Use this when you have static data that you want to transform or test
 * using the fluent expression API.
 *
 * @param value - Any static value (array, object, primitive)
 * @returns A chainable expression (only exposes .pipe(), .match(), .not)
 *
 * @example
 * // Static array with transformations
 * Literal(['apple', 'banana', 'cherry']).pipe(Transformer.Array.Filter(...))
 *
 * // Static value with condition
 * Literal(42).match(Condition.Number.GreaterThan(0))
 *
 * // Use with .each() for iteration
 * Literal([1, 2, 3]).each(Iterator.Map(Item().value()))
 */
export function Literal(value: ResolvableValue): ChainableExpr {
  const expr = ExpressionBuilder.from(value)
  stampCallsite(expr, captureCallsite(Literal))
  return expr
}
