import { buildConditionFunction } from '../helpers/createRegisterableFunction'
import { assertString } from './asserts'

export default {
  /**
   * Validates if a string is a valid UK postcode format
   * @param value - The string to validate as a UK postcode
   * @returns true if the string is a valid UK postcode format
   */
  IsValidPostcode: buildConditionFunction('isValidPostcode', value => {
    assertString(value, 'Condition.Address.IsValidPostcode')

    const postcodeRegex = /^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}| ?0A{2})$/i

    return postcodeRegex.test(value)
  }),
}
