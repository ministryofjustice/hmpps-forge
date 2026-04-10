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

export const fullNameField = GovUKTextInput({
  code: 'fullName',
  label: {
    text: 'What is your name?',
    classes: GovukUtilityClasses.Label.Large,
    isPageHeading: true,
  },
  classes: GovukUtilityClasses.Input.Width20,
  autocomplete: 'name',
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your full name',
    }),
    validation({
      condition: Self().match(Condition.String.HasMaxLength(200)),
      message: 'Full name must be 200 characters or less',
    }),
    validation({
      condition: Self().match(Condition.String.LettersWithSpaceDashApostrophe()),
      message: 'Full name must only include letters, spaces, hyphens and apostrophes',
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
