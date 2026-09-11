import { Self, Condition, Transformer, validation, submit, redirect, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKHeading, GovUKTextInput, GovUKButton, GovUKUtilityClasses } from '@ministryofjustice/hmpps-forge/govuk-components'
import { saveDraftAnswers } from './effects'

// This is the author-owned flavour of composite field. There is no single
// GovUKAddressInput component - the author lays out separate fields on one
// step and composes them on the summary page. Each field is standalone from
// Forge's point of view, which means each one gets its own answer, its own
// validation, and its own change link if needed.
const heading = GovUKHeading({ text: 'What is your address?' })

const addressLine1Field = GovUKTextInput({
  code: 'addressLine1',
  label: {
    text: 'Address line 1',
    classes: GovUKUtilityClasses.Label.Medium,
  },
  classes: GovUKUtilityClasses.Input.Width30,
  autocomplete: 'address-line1',
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter the first line of your address',
    }),
  ],
})

// Line 2 is optional. No validation means an empty value is accepted, and the
// summary page decides whether to show it based on whether the user filled it in.
const addressLine2Field = GovUKTextInput({
  code: 'addressLine2',
  label: {
    text: 'Address line 2 (optional)',
    classes: GovUKUtilityClasses.Label.Medium,
  },
  classes: GovUKUtilityClasses.Input.Width30,
  autocomplete: 'address-line2',
  formatters: [Transformer.String.Trim()],
})

const addressTownField = GovUKTextInput({
  code: 'addressTown',
  label: {
    text: 'Town or city',
    classes: GovUKUtilityClasses.Label.Medium,
  },
  classes: GovUKUtilityClasses.Input.Width20,
  autocomplete: 'address-level2',
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your town or city',
    }),
  ],
})

// Postcode has 2 validation rules: required, and a format check. The ordering
// matters - required runs first so a blank value triggers "Enter your postcode"
// rather than "Enter a valid postcode". Values are also upper-cased so stored
// answers are consistent.
const addressPostcodeField = GovUKTextInput({
  code: 'addressPostcode',
  label: {
    text: 'Postcode',
    classes: GovUKUtilityClasses.Label.Medium,
  },
  classes: GovUKUtilityClasses.Input.Width10,
  autocomplete: 'postal-code',
  formatters: [Transformer.String.Trim(), Transformer.String.ToUpperCase()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your postcode',
    }),
    validation({
      condition: Self().match(Condition.Address.IsValidPostcode()),
      message: 'Enter a real postcode',
    }),
  ],
})

const continueButton = GovUKButton({ text: 'Continue' })

// All four fields on one step, one validation pass, one save. Every missing or
// invalid field's message surfaces together in the error summary.
export const addressStep = step({
  code: 'address',
  path: '/address',
  title: 'What is your address?',
  blocks: [
    heading,
    addressLine1Field,
    addressLine2Field,
    addressTownField,
    addressPostcodeField,
    continueButton,
  ],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [saveDraftAnswers()],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
})
