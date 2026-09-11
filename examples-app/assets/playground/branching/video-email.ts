import { Self, Condition, Transformer, condition, validation, submit, redirect, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKTextInput, GovUKButton, GovUKUtilityClasses } from '@ministryofjustice/hmpps-forge/govuk-components'
import { saveDraftAnswers } from './effects'

// The invite must reach the visitor themselves, not a shared inbox.
const isPersonalEmail = condition({
  name: 'IsPersonalEmail',
  factory: () => (value: unknown) =>
    typeof value === 'string' && !/^(info|admin|office|enquiries)@/.test(value),
})

const videoEmailField = GovUKTextInput({
  code: 'videoEmail',
  label: {
    text: 'What email should we send the invite to?',
    classes: GovUKUtilityClasses.Label.Large,
    isPageHeading: true,
  },
  hint: { text: 'We will send a calendar invite with the video call details.' },
  inputType: 'email',
  autocomplete: 'email',
  classes: GovUKUtilityClasses.Input.Width20,
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
    validation({
      condition: Self().match(isPersonalEmail()),
      message: 'Enter a personal email address, not a shared inbox',
    }),
  ],
})

const continueButton = GovUKButton({ text: 'Continue' })

// Branch step for the video path — only reachable when visitType is 'video'.
// All branches converge on check-answers after collecting their details.
export const videoEmailStep = step({
  code: 'video-email',
  path: '/video-email',
  title: 'What email should we send the invite to?',
  blocks: [videoEmailField, continueButton],
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
