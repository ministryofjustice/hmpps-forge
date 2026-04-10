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
        dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
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
      }),
    },
    {
      value: 'phone',
      text: 'Phone',
      block: GovUKTextInput({
        code: 'phoneNumber',
        label: 'Phone number',
        dependentWhen: Answer('contactMethod').match(Condition.Equals('phone')),
        classes: GovukUtilityClasses.Input.Width20,
        inputType: 'tel',
        autocomplete: 'tel',
        formatters: [Transformer.String.Trim()],
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
      }),
    },
    {
      value: 'text',
      text: 'Text message',
      block: GovUKTextInput({
        code: 'mobileNumber',
        label: 'Mobile number',
        dependentWhen: Answer('contactMethod').match(Condition.Equals('text')),
        classes: GovukUtilityClasses.Input.Width20,
        inputType: 'tel',
        autocomplete: 'tel',
        formatters: [Transformer.String.Trim()],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Enter your mobile number',
          }),
          validation({
            condition: Self().match(Condition.Phone.IsValidUKMobile()),
            message: 'Enter a valid UK mobile number',
          }),
        ],
      }),
    },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select how you would like to be contacted',
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
