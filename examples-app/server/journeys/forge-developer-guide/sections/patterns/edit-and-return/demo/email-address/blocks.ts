import { Self, Condition, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKTextInput,
  GovUKButton,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const emailField = GovUKTextInput({
  code: 'emailAddress',
  label: {
    text: 'What is your email address?',
    classes: GovUKUtilityClasses.Label.Large,
    isPageHeading: true,
  },
  autocomplete: 'email',
  classes: GovUKUtilityClasses.Input.Width20,
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
