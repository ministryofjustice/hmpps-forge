import { Self, Condition, Transformer, validation, submit, redirect, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKTextInput, GovUKButton, GovUKUtilityClasses } from '@ministryofjustice/hmpps-forge/govuk-components'
import { IsUkPhoneNumber } from './conditions'
import { saveDraftAnswers } from '../effects'

const phoneNumberField = GovUKTextInput({
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
    validation({
      condition: Self().match(IsUkPhoneNumber()),
      message: 'Enter a UK phone number, like 07700 900982',
    }),
  ],
})

const continueButton = GovUKButton({ text: 'Continue' })

// Branch step for the phone path — only reachable when visitType is 'phone'.
// All branches converge on check-answers after collecting their details.
export const phoneNumberStep = step({
  code: 'phone-number',
  path: '/phone-number',
  title: 'What number should we call you on?',
  blocks: [phoneNumberField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [saveDraftAnswers('branching')],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
})
