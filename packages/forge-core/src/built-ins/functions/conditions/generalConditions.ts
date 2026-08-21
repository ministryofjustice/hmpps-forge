import { condition } from '../../../authoring/functions/condition'

export const GeneralConditions = {
  /** Checks if a value is not empty/null/undefined */
  IsRequired: condition('IsRequired', {
    factory: () => (value: unknown) =>
      !(
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
      ),
  }),

  /** Checks if a value is strictly equal to an expected value */
  Equals: condition('Equals', {
    factory: () => (value: unknown, expected: unknown) => value === expected,
  }),
}
