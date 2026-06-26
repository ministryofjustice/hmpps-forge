import { assertArray } from '../../shared/utils/asserts'
import { defineConditionFunctions } from '../utils/defineConditionFunctions'
import { ConditionFunctionExpr, ResolvableValue } from '../types/expressions.type'

/**
 * Array conditions for collection validation
 *
 * All config arguments accept both static values and expressions:
 * - Static: Condition.Array.Contains('admin')
 * - Dynamic: Condition.Array.Contains(Answer('requiredRole'))
 */
export interface ArrayConditionGroup {
  /**
   * Checks if a value is an array (not null, not undefined)
   * @returns true if value is an array
   */
  IsArray: (expected: ResolvableValue) => ConditionFunctionExpr

  /**
   * Checks if a value exists within an array of options
   * Uses strict equality (===) for comparison
   * @param expected - The array of options to search within
   * @returns true if the value is found in the expected array
   */
  IsIn: (expected: ResolvableValue) => ConditionFunctionExpr

  /**
   * Checks if an array contains a specific value
   * Uses strict equality (===) for comparison
   * @param expected - The value to search for
   * @returns true if the array contains the expected value
   */
  Contains: (expected: ResolvableValue) => ConditionFunctionExpr

  /**
   * Checks if an array contains any of the items from another array
   * Returns true if at least one item from the expected array is found in the value array
   * Uses strict equality (===) for comparison
   * @param expected - The array of values to search for
   * @returns true if the value array contains at least one item from the expected array
   */
  ContainsAny: (expected: ResolvableValue) => ConditionFunctionExpr

  /**
   * Checks if all items in the value array exist in the expected array
   * Order does not matter, and duplicates in the value array are allowed
   * Returns true for empty value arrays (vacuous truth)
   * Uses strict equality (===) for comparison
   * @param expected - The array that should contain all items from value
   * @returns true if every item in the value array exists in the expected array
   */
  ContainsAll: (expected: ResolvableValue) => ConditionFunctionExpr
}

export const { conditions: ArrayConditions, implementations: ArrayConditionsImplementations } =
  defineConditionFunctions<ArrayConditionGroup>({
    IsArray: () => (value: unknown) => {
      return Array.isArray(value)
    },

    IsIn: () => (value: unknown, expected: ResolvableValue) => {
      assertArray(expected, 'Condition.Array.IsIn (expected)')

      return expected.some(item => item === value)
    },

    Contains: () => (value: unknown, expected: ResolvableValue) => {
      assertArray(value, 'Condition.Array.Contains')

      return value.includes(expected)
    },

    ContainsAny: () => (value: unknown, expected: ResolvableValue) => {
      assertArray(value, 'Condition.Array.ContainsAny')
      assertArray(expected, 'Condition.Array.ContainsAny (expected)')
      if (value.length === 0 && expected.length === 0) {
        return true
      }

      return expected.some(item => value.includes(item))
    },

    ContainsAll: () => (value: unknown, expected: ResolvableValue) => {
      assertArray(value, 'Condition.Array.ContainsAll')
      assertArray(expected, 'Condition.Array.ContainsAll (expected)')
      if (value.length === 0 && expected.length === 0) {
        return true
      }

      return value.every(item => expected.includes(item))
    },
  })

export const ArrayConditionsRegistry = ArrayConditionsImplementations
