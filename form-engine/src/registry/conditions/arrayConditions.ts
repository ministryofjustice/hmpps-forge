import { assertArray } from '@form-engine/registry/utils/asserts'
import { defineConditions } from '@form-engine/registry/utils/createRegisterableFunction'
import { ValueExpr } from '../../form/types/expressions.type'

/**
 * Array conditions for collection validation
 *
 * All config arguments accept both static values and expressions:
 * - Static: Condition.Array.Contains('admin')
 * - Dynamic: Condition.Array.Contains(Answer('requiredRole'))
 */
export const { conditions: ArrayConditions, registry: ArrayConditionsRegistry } = defineConditions({
  /**
   * Checks if a value exists within an array of options
   * Uses strict equality (===) for comparison
   * @param value - The value to search for
   * @param expected - The array of options to search within
   * @returns true if the value is found in the expected array
   */
  IsIn: (value, expected: any[] | ValueExpr) => {
    assertArray(expected, 'Condition.Array.IsIn (expected)')

    return expected.includes(value)
  },

  /**
   * Checks if an array contains a specific value
   * Uses strict equality (===) for comparison
   * @param value - The array to search within
   * @param expected - The value to search for
   * @returns true if the array contains the expected value
   */
  Contains: (value: any[], expected: ValueExpr) => {
    assertArray(value, 'Condition.Array.Contains')

    return value.includes(expected)
  },

  /**
   * Checks if an array contains any of the items from another array
   * Returns true if at least one item from the expected array is found in the value array
   * Uses strict equality (===) for comparison
   * @param value - The array to search within
   * @param expected - The array of values to search for
   * @returns true if the value array contains at least one item from the expected array
   */
  ContainsAny: (value: any[], expected: any[] | ValueExpr) => {
    assertArray(value, 'Condition.Array.ContainsAny')
    assertArray(expected, 'Condition.Array.ContainsAny (expected)')
    if (value.length === 0 && expected.length === 0) {
      return true
    }

    return expected.some(item => value.includes(item))
  },

  /**
   * Checks if all items in the value array exist in the expected array
   * Order does not matter, and duplicates in the value array are allowed
   * Returns true for empty value arrays (vacuous truth)
   * Uses strict equality (===) for comparison
   * @param value - The array whose items should all be present in expected
   * @param expected - The array that should contain all items from value
   * @returns true if every item in the value array exists in the expected array
   */
  ContainsAll: (value: any[], expected: any[] | ValueExpr) => {
    assertArray(value, 'Condition.Array.ContainsAll')
    assertArray(expected, 'Condition.Array.ContainsAll (expected)')
    if (value.length === 0 && expected.length === 0) {
      return true
    }

    return value.every(item => expected.includes(item))
  },
})
