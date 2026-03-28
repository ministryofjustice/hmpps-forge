import { assertString } from '@form-engine/registry/utils/asserts'
import { defineConditions } from '@form-engine/registry/utils/createRegisterableFunction'

export const { conditions: PhoneConditions, registry: PhoneConditionsRegistry } = defineConditions({
  /**
   * Validates if a string is a valid phone number format
   * Accepts international format with optional + prefix and common separators
   * @param value - The string to validate as a phone number
   * @returns true if the string is a valid phone number format (7-20 digits)
   */
  IsValidPhoneNumber: value => {
    assertString(value, 'Condition.Phone.IsValidPhoneNumber')

    const phoneRegex = /^\+?[0-9\s().-]{7,20}$/

    return phoneRegex.test(value)
  },

  /**
   * Validates if a string is a valid UK mobile phone number
   * Accepts formats: 07xxx xxxxxx, +447xxx xxxxxx, (07xxx) xxxxxx
   * @param value - The string to validate as a UK mobile number
   * @returns true if the string is a valid UK mobile format
   */
  IsValidUKMobile: value => {
    assertString(value, 'Condition.Phone.IsValidUKMobile')

    const ukMobileRegex = /^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$/

    return ukMobileRegex.test(value)
  },
})
