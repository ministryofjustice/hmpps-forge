import { z } from 'zod'
import ConditionRegistry from '../registries/ConditionRegistry'

const phoneConditions = new ConditionRegistry()

export const PhoneConditions = {
  /** Validates if a string is a valid phone number format (7-20 digits) */
  IsValidPhoneNumber: phoneConditions.register('Phone.IsValidPhoneNumber', {
    inputSchema: z.string(),
  }, () => (value: string) => /^\+?[0-9\s().-]{7,20}$/.test(value)),

  /** Validates if a string is a valid UK mobile phone number */
  IsValidUKMobile: phoneConditions.register('Phone.IsValidUKMobile', {
    inputSchema: z.string(),
  }, () => (value: string) => /^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$/.test(value)),
}

export { phoneConditions as phoneConditionsRegistry }
