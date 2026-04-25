import { Self, Condition, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKTextInput,
  GovUKButton,
  GovukUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const emailField = GovUKTextInput({
  code: 'emailAddress',
  label: {
    text: 'What is your email address?',
    classes: GovukUtilityClasses.Label.Large,
    isPageHeading: true,
  },
  autocomplete: 'email',
  classes: GovukUtilityClasses.Input.Width20,
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
