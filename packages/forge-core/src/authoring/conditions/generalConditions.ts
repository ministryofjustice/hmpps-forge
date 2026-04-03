import { ConditionFunctionExpr, ValueExpr } from '../types/expressions.type'
import { defineConditionFunctions } from '../utils/defineConditionFunctions'

export interface GeneralConditionGroup {
  /**
   * Checks if a value is not empty/null/undefined
   * Returns false for: null, undefined, empty strings (after trim), empty arrays
   * @returns true if the value is considered "present" or "filled"
   */
  IsRequired: () => ConditionFunctionExpr

  /**
   * Checks if a value is strictly equal to an expected value
   * Uses === comparison (strict equality)
   * @param expected - The expected value to compare against
   * @returns true if value === expected
   */
  Equals: (expected: ValueExpr) => ConditionFunctionExpr
}

export const { conditions: GeneralConditions, implementations: GeneralConditionsImplementations } =
  defineConditionFunctions<GeneralConditionGroup>({
    IsRequired: () => (value: unknown) =>
      !(
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
      ),

    Equals: () => (value: unknown, expected: ValueExpr) => value === expected,
  })

export const GeneralConditionsRegistry = GeneralConditionsImplementations
