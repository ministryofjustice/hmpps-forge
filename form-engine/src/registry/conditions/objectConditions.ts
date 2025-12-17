import { defineConditions } from '@form-engine/registry/utils/createRegisterableFunction'
import { assertObject } from '@form-engine/registry/utils/asserts'
import { getByPath } from '../../utils/utils'

const isEmpty = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '')

export const { conditions: ObjectConditions, registry: ObjectConditionsRegistry } = defineConditions({
  /**
   * Checks if a value is a plain object (not null, not array)
   * @param value - The value to test
   * @returns true if value is a plain object
   */
  IsObject: value => value !== null && typeof value === 'object' && !Array.isArray(value),

  /**
   * Checks if an object has a property at the given path
   * Throws if value is not an object
   * @param value - The object to test
   * @param path - The property path (supports dot notation like 'user.address')
   * @returns true if object has the property
   */
  HasProperty: (value, path: string) => {
    assertObject(value, 'Condition.Object.HasProperty')

    return getByPath(value, path) !== undefined
  },

  /**
   * Checks if an object property at the given path is empty
   * Throws if value is not an object
   * @param value - The object to test
   * @param path - The property path (supports dot notation)
   * @returns true if the property is empty/missing
   */
  PropertyIsEmpty: (value, path: string) => {
    assertObject(value, 'Condition.Object.PropertyIsEmpty')

    return isEmpty(getByPath(value, path))
  },

  /**
   * Checks if an object property at the given path has a value (not empty)
   * Throws if value is not an object
   * @param value - The object to test
   * @param path - The property path (supports dot notation)
   * @returns true if the property has a non-empty value
   */
  PropertyHasValue: (value, path: string) => {
    assertObject(value, 'Condition.Object.PropertyHasValue')

    return !isEmpty(getByPath(value, path))
  },
})
