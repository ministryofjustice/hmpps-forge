import { GovUKDateInputFull, GovUKButton, GovUKUtilityClasses, GovUKValidations } from '@ministryofjustice/hmpps-forge/govuk-components'
import { saveDraftAnswers } from './effects'
import { submit, redirect, tieBreaker, step } from '@ministryofjustice/hmpps-forge/core/authoring'

const dateOfBirthField = GovUKDateInputFull({
  code: 'dateOfBirth',
  fieldset: {
    legend: {
      text: 'What is your date of birth?',
      classes: GovUKUtilityClasses.Fieldset.LargeLabel,
      isPageHeading: true,
    },
  },
  hint: { text: 'For example, 27 3 1990' },
  validWhen: [
    ...GovUKValidations.DateInputFull({
      empty: { message: 'Enter your date of birth' },
      missingDay: { message: 'Date of birth must include a day' },
      missingMonth: { message: 'Date of birth must include a month' },
      missingYear: { message: 'Date of birth must include a year' },
      invalid: { message: 'Date of birth must be a real date' },
      mustBePast: { message: 'Date of birth must be in the past', submissionOnly: true },
    }),
  ],
})

const continueButton = GovUKButton({ text: 'Continue' })

export const dateOfBirthStep = step({
  code: 'date-of-birth',
  path: '/date-of-birth',
  title: 'What is your date of birth?',
  reachability: {
    entryWhen: true,
    tieBreakers: [tieBreaker({ priority: 100 })],
  },
  blocks: [dateOfBirthField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [saveDraftAnswers()],
        next: [redirect({ goto: 'address' })],
      },
    }),
  ],
})
