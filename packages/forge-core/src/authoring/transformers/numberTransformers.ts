import { assertNumber } from '../../shared/utils/asserts'
import { createFunctionsRegistry } from '../utils/createFunctionsRegistry'
import { defineTransformerFunctions } from '../utils/defineTransformerFunctions'
import { TransformerFunctionExpr, ValueExpr } from '../types/expressions.type'

/**
 * Number transformation functions for mathematical operations and formatting
 *
 * All config arguments accept both static values and expressions:
 * - Static: Transformer.Number.Add(5)
 * - Dynamic: Transformer.Number.Add(Answer('quantity'))
 */
export interface NumberTransformerGroup {
  /**
   * Adds a number to the input value
   * @param addend - The number to add
   * @example
   * // Add(3) applied to 5 returns 8
   * // Add(Answer('tax')) applied to Answer('price') - dynamic addition
   */
  Add: (addend: number | ValueExpr) => TransformerFunctionExpr

  /**
   * Subtracts a number from the input value
   * @param subtrahend - The number to subtract
   * @example
   * // Subtract(3) applied to 10 returns 7
   */
  Subtract: (subtrahend: number | ValueExpr) => TransformerFunctionExpr

  /**
   * Multiplies the input value by a number
   * @param multiplier - The number to multiply by
   * @example
   * // Multiply(3) applied to 4 returns 12
   * // Multiply(Answer('quantity')) applied to Answer('price') - dynamic multiplication
   */
  Multiply: (multiplier: number | ValueExpr) => TransformerFunctionExpr

  /**
   * Divides the input value by a number
   * @param divisor - The number to divide by
   * @example
   * // Divide(3) applied to 15 returns 5
   */
  Divide: (divisor: number | ValueExpr) => TransformerFunctionExpr

  /**
   * Returns the absolute value of the input
   * @example
   * // Abs() applied to -5 returns 5
   */
  Abs: () => TransformerFunctionExpr

  /**
   * Rounds the number to the nearest integer
   * @example
   * // Round() applied to 4.7 returns 5
   */
  Round: () => TransformerFunctionExpr

  /**
   * Rounds the number down to the nearest integer
   * @example
   * // Floor() applied to 4.7 returns 4
   */
  Floor: () => TransformerFunctionExpr

  /**
   * Rounds the number up to the nearest integer
   * @example
   * // Ceil() applied to 4.2 returns 5
   */
  Ceil: () => TransformerFunctionExpr

  /**
   * Rounds the number to a specified number of decimal places
   * @param decimals - The number of decimal places to round to
   * @example
   * // ToFixed(2) applied to 3.14159 returns 3.14
   */
  ToFixed: (decimals: number | ValueExpr) => TransformerFunctionExpr

  /**
   * Returns the maximum of the input value and a comparison value
   * @param comparison - The value to compare against
   * @example
   * // Max(10) applied to 5 returns 10
   */
  Max: (comparison: number | ValueExpr) => TransformerFunctionExpr

  /**
   * Returns the minimum of the input value and a comparison value
   * @param comparison - The value to compare against
   * @example
   * // Min(10) applied to 5 returns 5
   */
  Min: (comparison: number | ValueExpr) => TransformerFunctionExpr

  /**
   * Raises the input value to the power of the exponent
   * @param exponent - The exponent to raise the value to
   * @example
   * // Power(3) applied to 2 returns 8
   */
  Power: (exponent: number | ValueExpr) => TransformerFunctionExpr

  /**
   * Returns the square root of the input value
   * @example
   * // Sqrt() applied to 16 returns 4
   */
  Sqrt: () => TransformerFunctionExpr

  /**
   * Clamps the input value between a minimum and maximum range
   * @param min - The minimum value (inclusive)
   * @param max - The maximum value (inclusive)
   * @example
   * // Clamp(5, 10) applied to 15 returns 10
   * // Clamp(5, 10) applied to 3 returns 5
   * // Clamp(5, 10) applied to 7 returns 7
   */
  Clamp: (min: number | ValueExpr, max: number | ValueExpr) => TransformerFunctionExpr
}

const { transformers: NumberTransformers, implementations } = defineTransformerFunctions<NumberTransformerGroup>({
  Add: () => (value: any, addend: number | ValueExpr) => {
    assertNumber(value, 'Transformer.Number.Add')
    assertNumber(addend, 'Transformer.Number.Add (addend)')
    return value + addend
  },

  Subtract: () => (value: any, subtrahend: number | ValueExpr) => {
    assertNumber(value, 'Transformer.Number.Subtract')
    assertNumber(subtrahend, 'Transformer.Number.Subtract (subtrahend)')
    return value - subtrahend
  },

  Multiply: () => (value: any, multiplier: number | ValueExpr) => {
    assertNumber(value, 'Transformer.Number.Multiply')
    assertNumber(multiplier, 'Transformer.Number.Multiply (multiplier)')
    return value * multiplier
  },

  Divide: () => (value: any, divisor: number | ValueExpr) => {
    assertNumber(value, 'Transformer.Number.Divide')
    assertNumber(divisor, 'Transformer.Number.Divide (divisor)')
    if (divisor === 0) {
      throw new Error('Division by zero is not allowed in Transformer.Number.Divide')
    }
    return value / divisor
  },

  Abs: () => (value: any) => {
    assertNumber(value, 'Transformer.Number.Abs')
    return Math.abs(value)
  },

  Round: () => (value: any) => {
    assertNumber(value, 'Transformer.Number.Round')
    return Math.round(value)
  },

  Floor: () => (value: any) => {
    assertNumber(value, 'Transformer.Number.Floor')
    return Math.floor(value)
  },

  Ceil: () => (value: any) => {
    assertNumber(value, 'Transformer.Number.Ceil')
    return Math.ceil(value)
  },

  ToFixed: () => (value: any, decimals: number | ValueExpr) => {
    assertNumber(value, 'Transformer.Number.ToFixed')
    assertNumber(decimals, 'Transformer.Number.ToFixed (decimals)')
    return parseFloat(value.toFixed(decimals))
  },

  Max: () => (value: any, comparison: number | ValueExpr) => {
    assertNumber(value, 'Transformer.Number.Max')
    assertNumber(comparison, 'Transformer.Number.Max (comparison)')
    return Math.max(value, comparison)
  },

  Min: () => (value: any, comparison: number | ValueExpr) => {
    assertNumber(value, 'Transformer.Number.Min')
    assertNumber(comparison, 'Transformer.Number.Min (comparison)')
    return Math.min(value, comparison)
  },

  Power: () => (value: any, exponent: number | ValueExpr) => {
    assertNumber(value, 'Transformer.Number.Power')
    assertNumber(exponent, 'Transformer.Number.Power (exponent)')
    return value ** exponent
  },

  Sqrt: () => (value: any) => {
    assertNumber(value, 'Transformer.Number.Sqrt')
    if (value < 0) {
      throw new Error('Cannot calculate square root of negative number in Transformer.Number.Sqrt')
    }
    return Math.sqrt(value)
  },

  Clamp: () => (value: any, min: number | ValueExpr, max: number | ValueExpr) => {
    assertNumber(value, 'Transformer.Number.Clamp')
    assertNumber(min, 'Transformer.Number.Clamp (min)')
    assertNumber(max, 'Transformer.Number.Clamp (max)')
    return Math.min(Math.max(value, min), max)
  },
})

const NumberTransformersRegistry = createFunctionsRegistry(implementations)

export { NumberTransformers, NumberTransformersRegistry }
