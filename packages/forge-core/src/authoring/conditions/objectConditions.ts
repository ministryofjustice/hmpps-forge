import { ConditionFunctionExpr } from '../types/expressions.type'
import { defineConditionFunctions } from '../utils/defineConditionFunctions'
import { assertObject, isAbsent } from '../../shared/utils/asserts'
import { getByPath } from '../../shared/utils/utils'

const isEmpty = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '')

export interface ObjectConditionGroup {
  /**
   * Checks if a value is a plain object (not null, not array)
   * @returns true if value is a plain object
   */
  IsObject: () => ConditionFunctionExpr

  /**
   * Checks if an object has a property at the given path
   * Throws if value is not an object
   * @param path - The property path (supports dot notation like 'user.address')
   * @returns true if object has the property
   */
  HasProperty: (path: string) => ConditionFunctionExpr

  /**
   * Checks if an object property at the given path is empty
   * Throws if value is not an object
   * @param path - The property path (supports dot notation)
   * @returns true if the property is empty/missing
   */
  PropertyIsEmpty: (path: string) => ConditionFunctionExpr

  /**
   * Checks if an object property at the given path has a value (not empty)
   * Throws if value is not an object
   * @param path - The property path (supports dot notation)
   * @returns true if the property has a non-empty value
   */
  PropertyHasValue: (path: string) => ConditionFunctionExpr
}

export const { conditions: ObjectConditions, implementations: ObjectConditionsImplementations } =
  defineConditionFunctions<ObjectConditionGroup>({
    IsObject: () => (value: unknown) => value !== null && typeof value === 'object' && !Array.isArray(value),

    HasProperty: () => (value: unknown, path: string) => {
      if (isAbsent(value)) {
        return false
      }

      assertObject(value, 'Condition.Object.HasProperty')

      return getByPath(value, path) !== undefined
    },

    PropertyIsEmpty: () => (value: unknown, path: string) => {
      if (isAbsent(value)) {
        return false
      }

      assertObject(value, 'Condition.Object.PropertyIsEmpty')

      return isEmpty(getByPath(value, path))
    },

    PropertyHasValue: () => (value: unknown, path: string) => {
      if (isAbsent(value)) {
        return false
      }

      assertObject(value, 'Condition.Object.PropertyHasValue')

      return !isEmpty(getByPath(value, path))
    },
  })

export const ObjectConditionsRegistry = ObjectConditionsImplementations
