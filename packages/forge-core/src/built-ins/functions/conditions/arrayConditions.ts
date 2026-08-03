import { z } from 'zod'
import ConditionRegistry from '../../../authoring/registries/ConditionRegistry'
import type { ResolvableValue } from '../../../authoring/types/expressions.type'

const arraySchema = z.array(z.unknown())
const arrayArgsSchema = z.tuple([z.array(z.unknown())])

const arrayConditions = new ConditionRegistry()

export const ArrayConditions = {
  /** Checks if a value is an array */
  IsArray: arrayConditions.register('Array.IsArray', () => (value: unknown) => Array.isArray(value)),

  /** Checks if a value exists within an array of options */
  IsIn: arrayConditions.register(
    'Array.IsIn',
    {
      argumentsSchema: arrayArgsSchema,
    },
    () => (value: unknown, expected: ResolvableValue) => (expected as unknown[]).some(item => item === value),
  ),

  /** Checks if an array contains a specific value */
  Contains: arrayConditions.register(
    'Array.Contains',
    {
      inputSchema: arraySchema,
    },
    () => (value: unknown, expected: ResolvableValue) => (value as unknown[]).includes(expected),
  ),

  /** Checks if an array contains any of the items from another array */
  ContainsAny: arrayConditions.register(
    'Array.ContainsAny',
    {
      inputSchema: arraySchema,
      argumentsSchema: arrayArgsSchema,
    },
    () => (value: unknown, expected: ResolvableValue) => {
      const arr = value as unknown[]
      const exp = expected as unknown[]

      if (arr.length === 0 && exp.length === 0) {
        return true
      }

      return exp.some(item => arr.includes(item))
    },
  ),

  /** Checks if all items in the value array exist in the expected array */
  ContainsAll: arrayConditions.register(
    'Array.ContainsAll',
    {
      inputSchema: arraySchema,
      argumentsSchema: arrayArgsSchema,
    },
    () => (value: unknown, expected: ResolvableValue) => {
      const arr = value as unknown[]
      const exp = expected as unknown[]

      if (arr.length === 0 && exp.length === 0) {
        return true
      }

      return arr.every(item => exp.includes(item))
    },
  ),
}

export { arrayConditions as arrayConditionsRegistry }
