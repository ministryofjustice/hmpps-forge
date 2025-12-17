import { assertNumber } from '@form-engine/registry/utils/asserts'
import { defineTransformers } from '@form-engine/registry/utils/createRegisterableFunction'
import { ValueExpr } from '@form-engine/form/types/expressions.type'

/**
 * Number transformation functions for mathematical operations and formatting
 *
 * All config arguments accept both static values and expressions:
 * - Static: Transformer.Number.Add(5)
 * - Dynamic: Transformer.Number.Add(Answer('quantity'))
 */
export const { transformers: NumberTransformers, registry: NumberTransformersRegistry } = defineTransformers({
  /**
   * Adds a number to the input value
   * @example
   * // Add(5, 3) returns 8
   * // Add(Answer('price'), Answer('tax')) - dynamic addition
   */
  Add: (value: any, addend: number | ValueExpr) => {
    assertNumber(value, 'Transformer.Number.Add')
    assertNumber(addend, 'Transformer.Number.Add (addend)')
    return value + addend
  },

  /**
   * Subtracts a number from the input value
   * @example
   * // Subtract(10, 3) returns 7
   */
  Subtract: (value: any, subtrahend: number | ValueExpr) => {
    assertNumber(value, 'Transformer.Number.Subtract')
    assertNumber(subtrahend, 'Transformer.Number.Subtract (subtrahend)')
    return value - subtrahend
  },

  /**
   * Multiplies the input value by a number
   * @example
   * // Multiply(4, 3) returns 12
   * // Multiply(Answer('price'), Answer('quantity')) - dynamic multiplication
   */
  Multiply: (value: any, multiplier: number | ValueExpr) => {
    assertNumber(value, 'Transformer.Number.Multiply')
    assertNumber(multiplier, 'Transformer.Number.Multiply (multiplier)')
    return value * multiplier
  },

  /**
   * Divides the input value by a number
   * @example
   * // Divide(15, 3) returns 5
   */
  Divide: (value: any, divisor: number | ValueExpr) => {
    assertNumber(value, 'Transformer.Number.Divide')
    assertNumber(divisor, 'Transformer.Number.Divide (divisor)')
    if (divisor === 0) {
      throw new Error('Division by zero is not allowed in Transformer.Number.Divide')
    }
    return value / divisor
  },

  /**
   * Returns the absolute value of the input
   * @example
   * // Abs(-5) returns 5
   */
  Abs: (value: any) => {
    assertNumber(value, 'Transformer.Number.Abs')
    return Math.abs(value)
  },

  /**
   * Rounds the number to the nearest integer
   * @example
   * // Round(4.7) returns 5
   */
  Round: (value: any) => {
    assertNumber(value, 'Transformer.Number.Round')
    return Math.round(value)
  },

  /**
   * Rounds the number down to the nearest integer
   * @example
   * // Floor(4.7) returns 4
   */
  Floor: (value: any) => {
    assertNumber(value, 'Transformer.Number.Floor')
    return Math.floor(value)
  },

  /**
   * Rounds the number up to the nearest integer
   * @example
   * // Ceil(4.2) returns 5
   */
  Ceil: (value: any) => {
    assertNumber(value, 'Transformer.Number.Ceil')
    return Math.ceil(value)
  },

  /**
   * Rounds the number to a specified number of decimal places
   * @example
   * // ToFixed(3.14159, 2) returns 3.14
   */
  ToFixed: (value: any, decimals: number | ValueExpr) => {
    assertNumber(value, 'Transformer.Number.ToFixed')
    assertNumber(decimals, 'Transformer.Number.ToFixed (decimals)')
    return parseFloat(value.toFixed(decimals))
  },

  /**
   * Returns the maximum of the input value and a comparison value
   * @example
   * // Max(5, 10) returns 10
   */
  Max: (value: any, comparison: number | ValueExpr) => {
    assertNumber(value, 'Transformer.Number.Max')
    assertNumber(comparison, 'Transformer.Number.Max (comparison)')
    return Math.max(value, comparison)
  },

  /**
   * Returns the minimum of the input value and a comparison value
   * @example
   * // Min(5, 10) returns 5
   */
  Min: (value: any, comparison: number | ValueExpr) => {
    assertNumber(value, 'Transformer.Number.Min')
    assertNumber(comparison, 'Transformer.Number.Min (comparison)')
    return Math.min(value, comparison)
  },

  /**
   * Raises the input value to the power of the exponent
   * @example
   * // Power(2, 3) returns 8
   */
  Power: (value: any, exponent: number | ValueExpr) => {
    assertNumber(value, 'Transformer.Number.Power')
    assertNumber(exponent, 'Transformer.Number.Power (exponent)')
    return value ** exponent
  },

  /**
   * Returns the square root of the input value
   * @example
   * // Sqrt(16) returns 4
   */
  Sqrt: (value: any) => {
    assertNumber(value, 'Transformer.Number.Sqrt')
    if (value < 0) {
      throw new Error('Cannot calculate square root of negative number in Transformer.Number.Sqrt')
    }
    return Math.sqrt(value)
  },

  /**
   * Clamps the input value between a minimum and maximum range
   * @example
   * // Clamp(15, 5, 10) returns 10
   * // Clamp(3, 5, 10) returns 5
   * // Clamp(7, 5, 10) returns 7
   */
  Clamp: (value: any, min: number | ValueExpr, max: number | ValueExpr) => {
    assertNumber(value, 'Transformer.Number.Clamp')
    assertNumber(min, 'Transformer.Number.Clamp (min)')
    assertNumber(max, 'Transformer.Number.Clamp (max)')
    return Math.min(Math.max(value, min), max)
  },
})
