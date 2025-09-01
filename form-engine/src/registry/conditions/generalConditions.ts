import { buildConditionFunction } from '@form-engine/registry/utils/buildCondition'

export default {
  /**
   * Checks if a value is not empty/null/undefined
   * Returns false for: null, undefined, empty strings (after trim), empty arrays
   * @param value - The value to test
   * @returns true if the value is considered "present" or "filled"
   */
  IsRequired: buildConditionFunction(
    'isRequired',
    value =>
      !(
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
      ),
  ),

  /**
   * Checks if a value is strictly equal to an expected value
   * Uses === comparison (strict equality)
   * @param value - The value to test
   * @param expected - The expected value to compare against
   * @returns true if value === expected
   */
  Equals: buildConditionFunction('equals', (value, expected) => value === expected),
}
