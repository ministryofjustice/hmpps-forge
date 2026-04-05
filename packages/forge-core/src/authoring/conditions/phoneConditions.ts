import { assertString } from '../../shared/utils/asserts'
import { ConditionFunctionExpr } from '../types/expressions.type'
import { defineConditionFunctions } from '../utils/defineConditionFunctions'

export interface PhoneConditionGroup {
  /**
   * Validates if a string is a valid phone number format
   * Accepts international format with optional + prefix and common separators
   * @returns true if the string is a valid phone number format (7-20 digits)
   */
  IsValidPhoneNumber: () => ConditionFunctionExpr

  /**
   * Validates if a string is a valid UK mobile phone number
   * Accepts formats: 07xxx xxxxxx, +447xxx xxxxxx, (07xxx) xxxxxx
   * @returns true if the string is a valid UK mobile format
   */
  IsValidUKMobile: () => ConditionFunctionExpr
}

export const { conditions: PhoneConditions, implementations: PhoneConditionsImplementations } =
  defineConditionFunctions<PhoneConditionGroup>({
    IsValidPhoneNumber: () => (value: unknown) => {
      assertString(value, 'Condition.Phone.IsValidPhoneNumber')

      const phoneRegex = /^\+?[0-9\s().-]{7,20}$/

      return phoneRegex.test(value)
    },

    IsValidUKMobile: () => (value: unknown) => {
      assertString(value, 'Condition.Phone.IsValidUKMobile')

      const ukMobileRegex = /^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$/

      return ukMobileRegex.test(value)
    },
  })

export const PhoneConditionsRegistry = PhoneConditionsImplementations
