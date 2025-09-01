import { buildConditionFunction } from '@form-engine/registry/utils/buildCondition'
import { assertString } from '@form-engine/registry/utils/asserts'

export default {
  /**
   * Validates if a string is a properly formatted email address
   * Checks for valid email format with proper domain structure
   * @param value - The string to validate as an email
   * @returns true if the string is a valid email format
   */
  IsValidEmail: buildConditionFunction('isValidEmail', value => {
    assertString(value, 'Condition.Email.IsValidEmail')

    const emailRegex =
      /^(?!.*\.\.)[a-z0-9_%+-](?:[a-z0-9._%+-]*[a-z0-9_%+-])?@([a-z0-9]+([a-z0-9-]*[a-z0-9]+)?\.)+[a-z]{2,6}$/i

    return emailRegex.test(value)
  }),
}
