import { assertString, isAbsent } from '../../shared/utils/asserts'
import { ConditionFunctionExpr } from '../types/expressions.type'
import { defineConditionFunctions } from '../utils/defineConditionFunctions'

export interface AddressConditionGroup {
  /**
   * Validates if a string is a valid UK postcode format
   * @returns true if the string is a valid UK postcode format
   */
  IsValidPostcode: () => ConditionFunctionExpr
}

export const { conditions: AddressConditions, implementations: AddressConditionsImplementations } =
  defineConditionFunctions<AddressConditionGroup>({
    IsValidPostcode: () => (value: unknown) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.Address.IsValidPostcode')

      const postcodeRegex = /^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}| ?0A{2})$/i

      return postcodeRegex.test(value)
    },
  })

export const AddressConditionsRegistry = AddressConditionsImplementations
