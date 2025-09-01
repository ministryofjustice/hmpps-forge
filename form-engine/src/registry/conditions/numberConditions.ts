import { buildConditionFunction } from '@form-engine/registry/utils/buildCondition'
import { assertNumber } from '@form-engine/registry/utils/asserts'

export default {
  /**
   * Checks if a number is greater than a threshold value
   * @param value - The number to test
   * @param threshold - The threshold to compare against
   * @returns true if value > threshold
   */
  GreaterThan: buildConditionFunction('greaterThan', (value, threshold: number) => {
    assertNumber(value, 'Condition.Number.GreaterThan')
    return value > threshold
  }),

  /**
   * Checks if a number is greater than or equal to a threshold value
   * @param value - The number to test
   * @param threshold - The threshold to compare against
   * @returns true if value >= threshold
   */
  GreaterThanOrEqual: buildConditionFunction('greaterThanOrEqual', (value, threshold: number) => {
    assertNumber(value, 'Condition.Number.GreaterThanOrEqual')
    return value >= threshold
  }),

  /**
   * Checks if a number is less than a threshold value
   * @param value - The number to test
   * @param threshold - The threshold to compare against
   * @returns true if value < threshold
   */
  LessThan: buildConditionFunction('lessThan', (value, threshold: number) => {
    assertNumber(value, 'Condition.Number.LessThan')
    return value < threshold
  }),

  /**
   * Checks if a number is less than or equal to a threshold value
   * @param value - The number to test
   * @param threshold - The threshold to compare against
   * @returns true if value <= threshold
   */
  LessThanOrEqual: buildConditionFunction('lessThanOrEqual', (value, threshold: number) => {
    assertNumber(value, 'Condition.Number.LessThanOrEqual')
    return value <= threshold
  }),

  /**
   * Checks if a number is between two values (inclusive)
   * @param value - The number to test
   * @param min - The minimum value (inclusive)
   * @param max - The maximum value (inclusive)
   * @returns true if min <= value <= max
   */
  Between: buildConditionFunction('between', (value, min: number, max: number) => {
    assertNumber(value, 'Condition.Number.Between')
    return value >= min && value <= max
  }),
}
