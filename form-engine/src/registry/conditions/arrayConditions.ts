import { buildConditionFunction } from '@form-engine/registry/utils/buildCondition'
import { assertArray } from '@form-engine/registry/utils/asserts'
import { ValueExpr } from '../../form/types/expressions.type'

export default {
  /**
   * Checks if a value exists within an array of options
   * Uses strict equality (===) for comparison
   * @param value - The value to search for
   * @param expected - The array of options to search within
   * @returns true if the value is found in the expected array
   */
  IsIn: buildConditionFunction('arrayIsIn', (value, expected: any[]) => {
    assertArray(expected, 'Condition.Array.IsIn')

    return expected.includes(value)
  }),

  /**
   * Checks if an array contains a specific value
   * Uses strict equality (===) for comparison
   * @param value - The array to search within
   * @param expected - The value to search for
   * @returns true if the array contains the expected value
   */
  Contains: buildConditionFunction('arrayContains', (value: any[], expected: ValueExpr) => {
    assertArray(value, 'Condition.Array.Contains')

    return value.includes(expected)
  }),

  /**
   * Checks if an array contains any of the items from another array
   * Returns true if at least one item from the expected array is found in the value array
   * Uses strict equality (===) for comparison
   * @param value - The array to search within
   * @param expected - The array of values to search for
   * @returns true if the value array contains at least one item from the expected array
   */
  ContainsAny: buildConditionFunction('arrayContainsAny', (value: any[], expected: any[]) => {
    assertArray(value, 'Condition.Array.ContainsAny')
    if (value.length === 0 && expected.length === 0) {
      return true
    }

    return expected.some(item => value.includes(item))
  }),

  /**
   * Checks if all items in the value array exist in the expected array
   * Order does not matter, and duplicates in the value array are allowed
   * Returns true for empty value arrays (vacuous truth)
   * Uses strict equality (===) for comparison
   * @param value - The array whose items should all be present in expected
   * @param expected - The array that should contain all items from value
   * @returns true if every item in the value array exists in the expected array
   */
  ContainsAll: buildConditionFunction('arrayContainsAll', (value: any[], expected: any[]) => {
    assertArray(value, 'Condition.Array.ContainsAll')
    if (value.length === 0 && expected.length === 0) {
      return true
    }

    return value.every(item => expected.includes(item))
  }),
}
