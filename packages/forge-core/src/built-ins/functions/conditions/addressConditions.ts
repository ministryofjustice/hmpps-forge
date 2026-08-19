import { z } from 'zod'
import { condition } from '../../../authoring/functions/condition'

export const AddressConditions = {
  /** Validates if a string is a valid UK postcode format */
  IsValidPostcode: condition('Address.IsValidPostcode', {
    inputSchema: z.string(),
    factory: () => (value: string) => /^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}| ?0A{2})$/i.test(value),
  }),
}
