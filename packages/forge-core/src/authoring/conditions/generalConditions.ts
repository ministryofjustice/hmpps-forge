import ConditionRegistry from '../registries/ConditionRegistry'
import type { ResolvableValue } from '../types/expressions.type'

const generalConditions = new ConditionRegistry()

export const GeneralConditions = {
  /** Checks if a value is not empty/null/undefined */
  IsRequired: generalConditions.register(
    'IsRequired',
    () => (value: unknown) =>
      !(
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
      ),
  ),

  /** Checks if a value is strictly equal to an expected value */
  Equals: generalConditions.register('Equals', () => (value: unknown, expected: ResolvableValue) => value === expected),
}

export { generalConditions as generalConditionsRegistry }
