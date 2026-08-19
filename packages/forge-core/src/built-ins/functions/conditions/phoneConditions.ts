import { z } from 'zod'
import { condition } from '../../../authoring/functions/condition'

export const PhoneConditions = {
  /** Validates if a string is a valid phone number format (7-20 digits) */
  IsValidPhoneNumber: condition('Phone.IsValidPhoneNumber', {
    inputSchema: z.string(),
    factory: () => (value: string) => /^\+?[0-9\s().-]{7,20}$/.test(value),
  }),

  /** Validates if a string is a valid UK mobile phone number */
  IsValidUKMobile: condition('Phone.IsValidUKMobile', {
    inputSchema: z.string(),
    factory: () => (value: string) => /^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$/.test(value),
  }),
}
