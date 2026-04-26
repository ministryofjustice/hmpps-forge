import {
  Self,
  Condition,
  Transformer,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKTextInput,
  GovUKButton,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const phoneNumberField = GovUKTextInput({
  code: 'phoneNumber',
  label: {
    text: 'What number should we call you on?',
    classes: GovUKUtilityClasses.Label.Large,
    isPageHeading: true,
  },
  inputType: 'tel',
  autocomplete: 'tel',
  classes: GovUKUtilityClasses.Input.Width20,
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a phone number',
    }),
    validation({
      condition: Self().match(Condition.Phone.IsValidPhoneNumber()),
      message: 'Enter a valid phone number',
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
