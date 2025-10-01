import { assertString } from '@form-engine/registry/utils/asserts'
import { defineConditions } from '@form-engine/registry/utils/createRegisterableFunction'

export const { conditions: EmailConditions, registry: EmailConditionsRegistry } = defineConditions({
  /**
   * Validates if a string is a properly formatted email address
   * Checks for valid email format with proper domain structure
   * @param value - The string to validate as an email
   * @returns true if the string is a valid email format
   */
  IsValidEmail: value => {
    assertString(value, 'Condition.Email.IsValidEmail')

    const emailRegex =
      /^(?!.*\.\.)[a-z0-9_%+-](?:[a-z0-9._%+-]*[a-z0-9_%+-])?@([a-z0-9]+([a-z0-9-]*[a-z0-9]+)?\.)+[a-z]{2,6}$/i

    return emailRegex.test(value)
  },
})
