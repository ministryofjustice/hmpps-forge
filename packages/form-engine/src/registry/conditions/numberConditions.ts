import { assertNumber } from '@form-engine/registry/utils/asserts'
import { defineConditions } from '@form-engine/registry/utils/createRegisterableFunction'
import { ValueExpr } from '@form-engine/form/types/expressions.type'

/**
 * Number conditions for numeric comparisons and validation
 *
 * All config arguments accept both static values and expressions:
 * - Static: Condition.Number.GreaterThan(18)
 * - Dynamic: Condition.Number.GreaterThan(Answer('minAge'))
 */
export const { conditions: NumberConditions, registry: NumberConditionsRegistry } = defineConditions({
  /**
   * Checks if a value is a number (not NaN, not a string, not undefined)
   * Use this to validate that a formatter successfully converted input to a number
   * @param value - The value to test
   * @returns true if value is a valid number
   */
  IsNumber: (value: unknown) => {
    return typeof value === 'number' && !Number.isNaN(value)
  },

  /**
   * Checks if a value is an integer (whole number)
   * Use this to validate that input is a valid integer after formatting
   * @param value - The value to test
   * @returns true if value is a valid integer
   */
  IsInteger: (value: unknown) => {
    return typeof value === 'number' && !Number.isNaN(value) && Number.isInteger(value)
  },

  /**
   * Checks if a number is greater than a threshold value
   * @param value - The number to test
   * @param threshold - The threshold to compare against
   * @returns true if value > threshold
   */
  GreaterThan: (value, threshold: number | ValueExpr) => {
    assertNumber(value, 'Condition.Number.GreaterThan')
    assertNumber(threshold, 'Condition.Number.GreaterThan (threshold)')
    return value > threshold
  },

  /**
   * Checks if a number is greater than or equal to a threshold value
   * @param value - The number to test
   * @param threshold - The threshold to compare against
   * @returns true if value >= threshold
   */
  GreaterThanOrEqual: (value, threshold: number | ValueExpr) => {
    assertNumber(value, 'Condition.Number.GreaterThanOrEqual')
    assertNumber(threshold, 'Condition.Number.GreaterThanOrEqual (threshold)')
    return value >= threshold
  },

  /**
   * Checks if a number is less than a threshold value
   * @param value - The number to test
   * @param threshold - The threshold to compare against
   * @returns true if value < threshold
   */
  LessThan: (value, threshold: number | ValueExpr) => {
    assertNumber(value, 'Condition.Number.LessThan')
    assertNumber(threshold, 'Condition.Number.LessThan (threshold)')
    return value < threshold
  },

  /**
   * Checks if a number is less than or equal to a threshold value
   * @param value - The number to test
   * @param threshold - The threshold to compare against
   * @returns true if value <= threshold
   */
  LessThanOrEqual: (value, threshold: number | ValueExpr) => {
    assertNumber(value, 'Condition.Number.LessThanOrEqual')
    assertNumber(threshold, 'Condition.Number.LessThanOrEqual (threshold)')
    return value <= threshold
  },

  /**
   * Checks if a number is between two values (inclusive)
   * @param value - The number to test
   * @param min - The minimum value (inclusive)
   * @param max - The maximum value (inclusive)
   * @returns true if min <= value <= max
   */
  Between: (value, min: number | ValueExpr, max: number | ValueExpr) => {
    assertNumber(value, 'Condition.Number.Between')
    assertNumber(min, 'Condition.Number.Between (min)')
    assertNumber(max, 'Condition.Number.Between (max)')
    return value >= min && value <= max
  },
})
