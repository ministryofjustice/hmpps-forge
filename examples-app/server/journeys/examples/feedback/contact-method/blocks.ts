import {
  Self,
  Answer,
  Condition,
  Transformer,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKRadioInput,
  GovUKTextInput,
  GovUKButton,
  GovukUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const contactMethodField = GovUKRadioInput({
  code: 'contactMethod',
  fieldset: {
    legend: {
      text: 'How should we contact you?',
      classes: GovukUtilityClasses.Fieldset.LargeLabel,
      isPageHeading: true,
    },
  },
  items: [
    {
      value: 'email',
      text: 'Email',
      block: GovUKTextInput({
        code: 'email',
        label: 'Email address',
        dependent: Answer('contactMethod').match(Condition.Equals('email')),
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
      }),
    },
    {
      value: 'phone',
      text: 'Phone',
      block: GovUKTextInput({
        code: 'phoneNumber',
        label: 'Phone number',
        dependent: Answer('contactMethod').match(Condition.Equals('phone')),
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
      }),
    },
    {
      value: 'text',
      text: 'Text message',
      block: GovUKTextInput({
        code: 'mobileNumber',
        label: 'Mobile number',
        dependent: Answer('contactMethod').match(Condition.Equals('text')),
        classes: GovukUtilityClasses.Input.Width20,
        inputType: 'tel',
        autocomplete: 'tel',
        formatters: [Transformer.String.Trim()],
        validate: [
          validation({
            when: Self().not.match(Condition.IsRequired()),
            message: 'Enter your mobile number',
          }),
          validation({
            when: Self().not.match(Condition.Phone.IsValidUKMobile()),
            message: 'Enter a valid UK mobile number',
          }),
        ],
      }),
    },
  ],
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Select how you would like to be contacted',
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
