import { z } from 'zod'
import ConditionRegistry from '../../../authoring/registries/ConditionRegistry'

const emailConditions = new ConditionRegistry()

// Domain labels use the unambiguous form `[a-z0-9](?:[a-z0-9-]*[a-z0-9])?` so any span
// matches exactly one way - no nested overlapping quantifiers, so no catastrophic
// backtracking. TLD is widened to the DNS label max (63) so real TLDs like `.engineering`
// pass. Kept strict: the lookahead still rejects consecutive dots.
const emailRegex =
  /^(?!.*\.\.)[a-z0-9_%+-](?:[a-z0-9._%+-]*[a-z0-9_%+-])?@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i

// RFC 5321 caps a full address at 254 characters. Rejecting anything longer before the
// regex runs bounds the input the pattern ever sees.
const MAX_EMAIL_LENGTH = 254

export const EmailConditions = {
  /** Validates if a string is a properly formatted email address */
  IsValidEmail: emailConditions.register('Email.IsValidEmail', {
    inputSchema: z.string(),
    factory: () => (value: string) => {
      if (value.length > MAX_EMAIL_LENGTH) {
        return false
      }

      return emailRegex.test(value)
    },
  }),
}

export { emailConditions as emailConditionsRegistry }
