import {
  Self,
  Condition,
  Transformer,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKTextInput,
  GovUKButton,
  GovukUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const videoEmailField = GovUKTextInput({
  code: 'videoEmail',
  label: {
    text: 'What email should we send the invite to?',
    classes: GovukUtilityClasses.Label.Large,
    isPageHeading: true,
  },
  hint: { text: 'We will send a calendar invite with the video call details.' },
  inputType: 'email',
  autocomplete: 'email',
  classes: GovukUtilityClasses.Input.Width20,
  formatters: [Transformer.String.Trim(), Transformer.String.ToLowerCase()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter an email address',
    }),
    validation({
      condition: Self().match(Condition.Email.IsValidEmail()),
      message: 'Enter a valid email address',
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
