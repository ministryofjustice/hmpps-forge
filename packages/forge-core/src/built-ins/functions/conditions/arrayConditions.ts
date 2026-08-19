import { z } from 'zod'
import { condition } from '../../../authoring/functions/condition'

const arraySchema = z.array(z.unknown())
const arrayArgsSchema = z.tuple([z.array(z.unknown())])

export const ArrayConditions = {
  /** Checks if a value is an array */
  IsArray: condition('Array.IsArray', { factory: () => (value: unknown) => Array.isArray(value) }),

  /** Checks if a value exists within an array of options */
  IsIn: condition('Array.IsIn', {
    argumentsSchema: arrayArgsSchema,
    factory: () => (value: unknown, expected: unknown[]) => expected.some(item => item === value),
  }),

  /** Checks if an array contains a specific value */
  Contains: condition('Array.Contains', {
    inputSchema: arraySchema,
    factory: () => (value: unknown[], expected: unknown) => value.includes(expected),
  }),

  /** Checks if an array contains any of the items from another array */
  ContainsAny: condition('Array.ContainsAny', {
    inputSchema: arraySchema,
    argumentsSchema: arrayArgsSchema,
    factory: () => (value: unknown[], expected: unknown[]) => {
      if (value.length === 0 && expected.length === 0) {
        return true
      }

      return expected.some(item => value.includes(item))
    },
  }),

  /** Checks if all items in the value array exist in the expected array */
  ContainsAll: condition('Array.ContainsAll', {
    inputSchema: arraySchema,
    argumentsSchema: arrayArgsSchema,
    factory: () => (value: unknown[], expected: unknown[]) => {
      if (value.length === 0 && expected.length === 0) {
        return true
      }

      return value.every(item => expected.includes(item))
    },
  }),
}
