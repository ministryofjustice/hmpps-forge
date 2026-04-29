import { ResolvableValue, ConditionFunctionExpr } from '../types/expressions.type'
import { defineConditionFunctions } from '../utils/defineConditionFunctions'
import { assertNumber } from '../../shared/utils/asserts'

/**
 * Number conditions for numeric comparisons and validation
 *
 * All config arguments accept both static values and expressions:
 * - Static: Condition.Number.GreaterThan(18)
 * - Dynamic: Condition.Number.GreaterThan(Answer('minAge'))
 */
export interface NumberConditionGroup {
  /**
   * Checks if a value is a number (not NaN, not a string, not undefined)
   * Use this to validate that a formatter successfully converted input to a number
   * @returns true if value is a valid number
   */
  IsNumber: () => ConditionFunctionExpr

  /**
   * Checks if a value is an integer (whole number)
   * Use this to validate that input is a valid integer after formatting
   * @returns true if value is a valid integer
   */
  IsInteger: () => ConditionFunctionExpr

  /**
   * Checks if a number is greater than a threshold value
   * @param threshold - The threshold to compare against
   * @returns true if value > threshold
   */
  GreaterThan: (threshold: ResolvableValue) => ConditionFunctionExpr

  /**
   * Checks if a number is greater than or equal to a threshold value
   * @param threshold - The threshold to compare against
   * @returns true if value >= threshold
   */
  GreaterThanOrEqual: (threshold: ResolvableValue) => ConditionFunctionExpr

  /**
   * Checks if a number is less than a threshold value
   * @param threshold - The threshold to compare against
   * @returns true if value < threshold
   */
  LessThan: (threshold: ResolvableValue) => ConditionFunctionExpr

  /**
   * Checks if a number is less than or equal to a threshold value
   * @param threshold - The threshold to compare against
   * @returns true if value <= threshold
   */
  LessThanOrEqual: (threshold: ResolvableValue) => ConditionFunctionExpr

  /**
   * Checks if a number is between two values (inclusive)
   * @param min - The minimum value (inclusive)
   * @param max - The maximum value (inclusive)
   * @returns true if min <= value <= max
   */
  Between: (min: ResolvableValue, max: ResolvableValue) => ConditionFunctionExpr
}

export const { conditions: NumberConditions, implementations: NumberConditionsImplementations } =
  defineConditionFunctions<NumberConditionGroup>({
    IsNumber: () => (value: unknown) => {
      return typeof value === 'number' && !Number.isNaN(value)
    },

    IsInteger: () => (value: unknown) => {
      return typeof value === 'number' && !Number.isNaN(value) && Number.isInteger(value)
    },

    GreaterThan: () => (value: unknown, threshold: number | ResolvableValue) => {
      assertNumber(value, 'Condition.Number.GreaterThan')
      assertNumber(threshold, 'Condition.Number.GreaterThan (threshold)')

      return value > threshold
    },

    GreaterThanOrEqual: () => (value: unknown, threshold: number | ResolvableValue) => {
      assertNumber(value, 'Condition.Number.GreaterThanOrEqual')
      assertNumber(threshold, 'Condition.Number.GreaterThanOrEqual (threshold)')

      return value >= threshold
    },

    LessThan: () => (value: unknown, threshold: number | ResolvableValue) => {
      assertNumber(value, 'Condition.Number.LessThan')
      assertNumber(threshold, 'Condition.Number.LessThan (threshold)')

      return value < threshold
    },

    LessThanOrEqual: () => (value: unknown, threshold: number | ResolvableValue) => {
      assertNumber(value, 'Condition.Number.LessThanOrEqual')
      assertNumber(threshold, 'Condition.Number.LessThanOrEqual (threshold)')

      return value <= threshold
    },

    Between: () => (value: unknown, min: number | ResolvableValue, max: number | ResolvableValue) => {
      assertNumber(value, 'Condition.Number.Between')
      assertNumber(min, 'Condition.Number.Between (min)')
      assertNumber(max, 'Condition.Number.Between (max)')

      return value >= min && value <= max
    },
  })

export const NumberConditionsRegistry = NumberConditionsImplementations
