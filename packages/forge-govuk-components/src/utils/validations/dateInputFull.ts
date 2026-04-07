import { and, Condition, Self, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import type { ValidationExpr } from '@ministryofjustice/hmpps-forge/core/authoring'

type ValidationMessage = string | { message: string; submissionOnly?: boolean }

interface DateInputFullMessages {
  empty: ValidationMessage
  missingDay: ValidationMessage
  missingMonth: ValidationMessage
  missingYear: ValidationMessage
  invalid: ValidationMessage
  mustBePast?: ValidationMessage
  mustBeFuture?: ValidationMessage
}

function toOptions(input: ValidationMessage): { message: string; submissionOnly?: boolean } {
  if (typeof input === 'string') {
    return { message: input }
  }

  return input
}

export function DateInputFull(messages: DateInputFullMessages): ValidationExpr[] {
  const validations: ValidationExpr[] = []

  const empty = toOptions(messages.empty)

  validations.push(
    validation({
      when: and(
        Self().match(Condition.Object.IsObject()),
        Self().not.match(Condition.Object.PropertyHasValue('day')),
        Self().not.match(Condition.Object.PropertyHasValue('month')),
        Self().not.match(Condition.Object.PropertyHasValue('year')),
      ),
      message: empty.message,
      submissionOnly: empty.submissionOnly,
    }),
  )

  const fieldChecks = [
    { key: 'missingDay' as const, field: 'day' },
    { key: 'missingMonth' as const, field: 'month' },
    { key: 'missingYear' as const, field: 'year' },
  ]

  for (const { key, field } of fieldChecks) {
    const opts = toOptions(messages[key])

    validations.push(
      validation({
        when: and(
          Self().match(Condition.Object.IsObject()),
          Self().not.match(Condition.Object.PropertyHasValue(field)),
        ),
        message: opts.message,
        details: { field },
        submissionOnly: opts.submissionOnly,
      }),
    )
  }

  const invalid = toOptions(messages.invalid)

  validations.push(
    validation({
      when: Self().not.match(Condition.Date.IsValid()),
      message: invalid.message,
      submissionOnly: invalid.submissionOnly,
    }),
  )

  if (messages.mustBePast) {
    const opts = toOptions(messages.mustBePast)

    validations.push(
      validation({
        when: Self().match(Condition.Date.IsFutureDate()),
        message: opts.message,
        submissionOnly: opts.submissionOnly,
      }),
    )
  }

  if (messages.mustBeFuture) {
    const opts = toOptions(messages.mustBeFuture)

    validations.push(
      validation({
        when: Self().match(Condition.Date.IsPastDate()),
        message: opts.message,
        submissionOnly: opts.submissionOnly,
      }),
    )
  }

  return validations
}
