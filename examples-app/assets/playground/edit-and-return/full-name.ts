import { Self, Condition, Transformer, validation, submit, redirect, Query, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKTextInput, GovUKButton, GovUKUtilityClasses } from '@ministryofjustice/hmpps-forge/govuk-components'
import { saveDraftAnswers } from './effects'

const fullNameField = GovUKTextInput({
  code: 'fullName',
  label: {
    text: 'What is your full name?',
    classes: GovUKUtilityClasses.Label.Large,
    isPageHeading: true,
  },
  autocomplete: 'name',
  classes: GovUKUtilityClasses.Input.Width20,
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your full name',
    }),
    validation({
      condition: Self().match(Condition.String.HasMaxLength(100)),
      message: 'Full name must be 100 characters or less',
    }),
  ],
})

const continueButton = GovUKButton({ text: 'Continue' })

export const fullNameStep = step({
  code: 'full-name',
  path: '/full-name',
  title: 'What is your full name?',
  reachability: { entryWhen: true },
  blocks: [fullNameField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [saveDraftAnswers()],
        next: [
          // When the user arrived via a change link, return to the summary
          redirect({
            when: Query('returnTo').match(Condition.Equals('check-answers')),
            goto: 'check-answers',
          }),
          redirect({ goto: 'email-address' }),
        ],
      },
    }),
  ],
})
