import { Transformer } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKDateInputFull,
  GovUKButton,
  GovukUtilityClasses,
  GovukValidations,
} from '@ministryofjustice/hmpps-forge/govuk-components'

// GovUKDateInputFull renders 3 inputs (day, month, year) but is a single field
// from Forge's point of view. The browser submits { day, month, year }, which
// Transformer.Object.ToISO collapses into a string like "1990-03-27" before
// validation runs. That means downstream code sees one answer, not three.
export const dateOfBirthField = GovUKDateInputFull({
  code: 'dateOfBirth',
  fieldset: {
    legend: {
      text: 'What is your date of birth?',
      classes: GovukUtilityClasses.Fieldset.LargeLabel,
      isPageHeading: true,
    },
  },
  hint: { text: 'For example, 27 3 1990' },
  formatters: [Transformer.Object.ToISO({ year: 'year', month: 'month', day: 'day' })],
  validWhen: [
    ...GovukValidations.DateInputFull({
      empty: { message: 'Enter your date of birth', submissionOnly: true },
      missingDay: { message: 'Date of birth must include a day', submissionOnly: true },
      missingMonth: { message: 'Date of birth must include a month', submissionOnly: true },
      missingYear: { message: 'Date of birth must include a year', submissionOnly: true },
      invalid: { message: 'Date of birth must be a real date', submissionOnly: true },
      mustBePast: { message: 'Date of birth must be in the past', submissionOnly: true },
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
