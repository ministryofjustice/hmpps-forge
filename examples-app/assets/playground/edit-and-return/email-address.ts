import { Self, Condition, validation, submit, redirect, Query, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKTextInput, GovUKButton, GovUKUtilityClasses } from '@ministryofjustice/hmpps-forge/govuk-components'
import { saveDraftAnswers } from './effects'

const emailField = GovUKTextInput({
  code: 'emailAddress',
  label: {
    text: 'What is your email address?',
    classes: GovUKUtilityClasses.Label.Large,
    isPageHeading: true,
  },
  autocomplete: 'email',
  classes: GovUKUtilityClasses.Input.Width20,
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
  ],
})

const continueButton = GovUKButton({ text: 'Continue' })

export const emailAddressStep = step({
  code: 'email-address',
  path: '/email-address',
  title: 'What is your email address?',
  reachability: { entryWhen: true },
  blocks: [emailField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [saveDraftAnswers()],
        next: [
          redirect({
            when: Query('returnTo').match(Condition.Equals('check-answers')),
            goto: 'check-answers',
          }),
          redirect({ goto: 'contact-preference' }),
        ],
      },
    }),
  ],
})
