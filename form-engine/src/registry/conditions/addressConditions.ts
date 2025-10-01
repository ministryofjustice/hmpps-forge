import { assertString } from '@form-engine/registry/utils/asserts'
import { defineConditions } from '@form-engine/registry/utils/createRegisterableFunction'

export const { conditions: AddressConditions, registry: AddressConditionsRegistry } = defineConditions({
  /**
   * Validates if a string is a valid UK postcode format
   * @internal value - The string to validate as a UK postcode
   * @returns true if the string is a valid UK postcode format
   */
  IsValidPostcode: value => {
    assertString(value, 'Condition.Address.IsValidPostcode')

    const postcodeRegex = /^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}| ?0A{2})$/i

    return postcodeRegex.test(value)
  },
})
