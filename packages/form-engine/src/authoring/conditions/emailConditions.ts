import { assertString } from '../utils/asserts'
import { ConditionFunctionExpr } from '../types/expressions.type'
import { defineConditionFunctions } from '../utils/defineFunction'

export interface EmailConditionGroup {
  /**
   * Validates if a string is a properly formatted email address
   * Checks for valid email format with proper domain structure
   * @returns true if the string is a valid email format
   */
  IsValidEmail: () => ConditionFunctionExpr
}

export const { conditions: EmailConditions, implementations: EmailConditionsImplementations } =
  defineConditionFunctions<EmailConditionGroup>({
    IsValidEmail: () => (value: unknown) => {
      assertString(value, 'Condition.Email.IsValidEmail')

      const emailRegex =
        /^(?!.*\.\.)[a-z0-9_%+-](?:[a-z0-9._%+-]*[a-z0-9_%+-])?@([a-z0-9]+([a-z0-9-]*[a-z0-9]+)?\.)+[a-z]{2,6}$/i

      return emailRegex.test(value)
    },
  })

export const EmailConditionsRegistry = EmailConditionsImplementations
