import { condition } from '@ministryofjustice/hmpps-forge/core/authoring'

// Accepts UK formats like 07700 900982, 020 7946 0123, and +44 7700 900982.
export const IsUkPhoneNumber = condition('IsUkPhoneNumber', {
  factory: () => (value: unknown) =>
    typeof value === 'string' && /^(?:\+44|0)\d{9,10}$/.test(value.replace(/[\s()-]/g, '')),
})
