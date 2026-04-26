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

export const fullNameField = GovUKTextInput({
  code: 'fullName',
  label: {
    text: 'What is your name?',
    classes: GovUKUtilityClasses.Label.Large,
    isPageHeading: true,
  },
  autocomplete: 'name',
  classes: GovUKUtilityClasses.Input.Width20,
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your name',
    }),
    validation({
      condition: Self().match(Condition.String.HasMaxLength(100)),
      message: 'Name must be 100 characters or less',
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
