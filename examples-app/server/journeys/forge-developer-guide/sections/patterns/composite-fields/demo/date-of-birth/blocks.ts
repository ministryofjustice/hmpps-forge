import {
  GovUKDateInputFull,
  GovUKButton,
  GovukUtilityClasses,
  GovukValidations,
} from '@ministryofjustice/hmpps-forge/govuk-components'

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
  validWhen: [
    ...GovukValidations.DateInputFull({
      empty: { message: 'Enter your date of birth' },
      missingDay: { message: 'Date of birth must include a day' },
      missingMonth: { message: 'Date of birth must include a month' },
      missingYear: { message: 'Date of birth must include a year' },
      invalid: { message: 'Date of birth must be a real date' },
      mustBePast: { message: 'Date of birth must be in the past', submissionOnly: true },
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
