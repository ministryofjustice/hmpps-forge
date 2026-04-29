import { Self, Condition, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKTextInput,
  GovUKButton,
  GovUKHeading,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'What is your full name?',
  size: 'l',
})

export const nameField = GovUKTextInput({
  code: 'visitorName',
  label: {
    text: 'Full name',
    classes: GovUKUtilityClasses.Label.Medium,
  },
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your full name',
      submissionOnly: true,
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
