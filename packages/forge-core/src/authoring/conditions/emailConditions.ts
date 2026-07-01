import { z } from 'zod'
import ConditionRegistry from '../registries/ConditionRegistry'

const emailConditions = new ConditionRegistry()

export const EmailConditions = {
  /** Validates if a string is a properly formatted email address */
  IsValidEmail: emailConditions.register('Email.IsValidEmail', {
    inputSchema: z.string(),
  }, () => (value: string) => {
    const emailRegex =
      /^(?!.*\.\.)[a-z0-9_%+-](?:[a-z0-9._%+-]*[a-z0-9_%+-])?@([a-z0-9]+([a-z0-9-]*[a-z0-9]+)?\.)+[a-z]{2,6}$/i

    return emailRegex.test(value)
  }),
}

export { emailConditions as emailConditionsRegistry }
