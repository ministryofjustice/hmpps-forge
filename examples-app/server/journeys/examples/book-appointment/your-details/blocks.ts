import {
  Self,
  Answer,
  Condition,
  Transformer,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKTextInput,
  GovUKButton,
  GovukUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({ text: 'Your details' })

export const fullNameField = GovUKTextInput({
  code: 'fullName',
  label: {
    text: 'Full name',
    classes: GovukUtilityClasses.Label.Medium,
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

export const emailField = GovUKTextInput({
  code: 'email',
  label: {
    text: 'Email address',
    classes: GovukUtilityClasses.Label.Medium,
  },
  hint: { text: 'We will send your appointment confirmation here' },
  classes: GovukUtilityClasses.Input.Width20,
  inputType: 'email',
  autocomplete: 'email',
  formatters: [Transformer.String.Trim(), Transformer.String.ToLowerCase()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
    validation({
      condition: Self().match(Condition.Email.IsValidEmail()),
      message: 'Enter a valid email address',
    }),
  ],
})

// FORGE-EXAMPLE:
// `visibleWhen` and `dependentWhen` control conditional fields.
// `visibleWhen` controls rendering - the field is shown when the predicate is true.
// `dependentWhen` controls validation and value - when false, validation is skipped and
// the answer is cleared, preventing stale data when the user changes their selection.
export const phoneNumberField = GovUKTextInput({
  code: 'phoneNumber',
  label: {
    text: 'Phone number',
    classes: GovukUtilityClasses.Label.Medium,
  },
  hint: { text: 'We will call you on this number for your appointment' },
  classes: GovukUtilityClasses.Input.Width20,
  inputType: 'tel',
  autocomplete: 'tel',
  formatters: [Transformer.String.Trim()],
  dependentWhen: Answer('appointmentType').match(Condition.Equals('phone')),
  visibleWhen: Answer('appointmentType').match(Condition.Equals('phone')),
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your phone number',
    }),
    validation({
      condition: Self().match(Condition.Phone.IsValidPhoneNumber()),
      message: 'Enter a valid phone number',
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
