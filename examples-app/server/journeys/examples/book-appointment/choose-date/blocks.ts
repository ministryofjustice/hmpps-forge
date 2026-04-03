import {
  Self,
  Answer,
  Condition,
  Transformer,
  Generator,
  match,
  and,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKWarningText,
  GovUKInsetText,
  GovUKButton,
  GovukUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import { MOJDatePicker } from '@ministryofjustice/hmpps-forge/moj-components'

export const appointmentDateField = MOJDatePicker({
  code: 'appointmentDate',
  label: {
    text: 'Appointment date',
    classes: GovukUtilityClasses.Label.Large,
    isPageHeading: true,
  },
  hint: { text: 'For example, 27/11/2024' },
  // FORGE-EXAMPLE:
  // Generator.Date.Today() produces the current date at runtime.
  // Piping it through Transformer.Date.AddDays(30) and Transformer.Date.Format('DD/MM/YYYY')
  // creates a dynamic date constraint that is always 30 days from today.
  minDate: Generator.Date.Today().pipe(Transformer.Date.Format('DD/MM/YYYY')),
  maxDate: Generator.Date.Today().pipe(
    Transformer.Date.AddDays(30),
    Transformer.Date.Format('DD/MM/YYYY'),
  ),
  excludedDays: ['saturday', 'sunday'],
  // FORGE-EXAMPLE:
  // ToISODate() converts the DD/MM/YYYY input to ISO format (YYYY-MM-DD)
  // before validation runs, so the date conditions (IsValid, IsFutureDate, etc.) work correctly.
  formatters: [Transformer.String.ToISODate()],
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter an appointment date',
    }),
    validation({
      when: Self().not.match(Condition.Date.IsValid()),
      message: 'Enter a valid date',
    }),
    validation({
      when: and(
        Self().not.match(Condition.Date.IsToday()),
        Self().not.match(Condition.Date.IsFutureDate()),
      ),
      message: 'Appointment date must be today or in the future',
    }),
  ],
})

export const weekdayWarning = GovUKWarningText({
  text: 'Appointments are only available on weekdays (Monday to Friday).',
})

// FORGE-EXAMPLE:
// match() provides multi-branch conditional content, like a switch statement.
// Each branch tests the referenced answer against a condition and returns the matching value.
export const appointmentTypeInset = GovUKInsetText({
  text: match(Answer('appointmentType'))
    .branch(
      Condition.Equals('in-person'),
      'We will confirm your appointment location by email after booking.',
    )
    .branch(
      Condition.Equals('phone'),
      'We will call you on the phone number you provided at the appointment time.',
    )
    .branch(
      Condition.Equals('video'),
      'We will send you a video call link by email before your appointment.',
    )
    .otherwise(''),
})

export const continueButton = GovUKButton({ text: 'Continue' })
