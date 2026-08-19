import { z } from 'zod'
import ConditionRegistry from '../../../authoring/registries/ConditionRegistry'

/** Gets a value from an object using a dot-notation path (e.g. 'user.profile.name') */
function getByPath(obj: unknown, path: string): unknown {
  if (obj == null) {
    return undefined
  }

  if (path === '') {
    return obj
  }

  return path.split('.').reduce<unknown>((current, key) => {
    if (current == null || typeof current !== 'object') {
      return undefined
    }

    return (current as Record<string, unknown>)[key]
  }, obj)
}

const isEmpty = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '')

const objectSchema = z.custom<Record<string, unknown>>(v => v !== null && typeof v === 'object' && !Array.isArray(v))
const stringArgsSchema = z.tuple([z.string()])

const objectConditions = new ConditionRegistry()

export const ObjectConditions = {
  /** Checks if a value is a plain object (not null, not array) */
  IsObject: objectConditions.register('Object.IsObject', {
    factory: () => (value: unknown) => value !== null && typeof value === 'object' && !Array.isArray(value),
  }),

  /** Checks if an object has a property at the given path */
  HasProperty: objectConditions.register('Object.HasProperty', {
    inputSchema: objectSchema,
    argumentsSchema: stringArgsSchema,
    factory: () => (value: unknown, path: string) => getByPath(value, path) !== undefined,
  }),

  /** Checks if an object property at the given path is empty */
  PropertyIsEmpty: objectConditions.register('Object.PropertyIsEmpty', {
    inputSchema: objectSchema,
    argumentsSchema: stringArgsSchema,
    factory: () => (value: unknown, path: string) => isEmpty(getByPath(value, path)),
  }),

  /** Checks if an object property at the given path has a value (not empty) */
  PropertyHasValue: objectConditions.register('Object.PropertyHasValue', {
    inputSchema: objectSchema,
    argumentsSchema: stringArgsSchema,
    factory: () => (value: unknown, path: string) => !isEmpty(getByPath(value, path)),
  }),
}

export { objectConditions as objectConditionsRegistry }
