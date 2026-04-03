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
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your full name',
    }),
    validation({
      when: Self().not.match(Condition.String.HasMaxLength(200)),
      message: 'Full name must be 200 characters or less',
    }),
    validation({
      when: Self().not.match(Condition.String.LettersWithSpaceDashApostrophe()),
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
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
    validation({
      when: Self().not.match(Condition.Email.IsValidEmail()),
      message: 'Enter a valid email address',
    }),
  ],
})

// FORGE-EXAMPLE:
// `hidden` and `dependent` work together for conditional fields.
// `hidden` controls visibility - the field is not rendered when the predicate is true.
// `dependent` controls validation and value - when false, validation is skipped and
// the answer is cleared, preventing stale data when the user changes their selection.
// They are typically logical opposites of each other.
export const phoneNumberField = GovUKTextInput({
  code: 'phoneNumber',
  label: {
    text: 'Phone number',
    classes: GovukUtilityClasses.Label.Medium,
  },
  hint: { text: 'We will call you on this number for your appointment' },
  dependent: Answer('appointmentType').match(Condition.Equals('phone')),
  hidden: Answer('appointmentType').not.match(Condition.Equals('phone')),
  classes: GovukUtilityClasses.Input.Width20,
  inputType: 'tel',
  autocomplete: 'tel',
  formatters: [Transformer.String.Trim()],
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your phone number',
    }),
    validation({
      when: Self().not.match(Condition.Phone.IsValidPhoneNumber()),
      message: 'Enter a valid phone number',
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
