import ConditionRegistry from '../../../authoring/registries/ConditionRegistry'

const generalConditions = new ConditionRegistry()

export const GeneralConditions = {
  /** Checks if a value is not empty/null/undefined */
  IsRequired: generalConditions.register('IsRequired', {
    factory: () => (value: unknown) =>
      !(
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
      ),
  }),

  /** Checks if a value is strictly equal to an expected value */
  Equals: generalConditions.register('Equals', {
    factory: () => (value: unknown, expected: unknown) => value === expected,
  }),
}

export { generalConditions as generalConditionsRegistry }
