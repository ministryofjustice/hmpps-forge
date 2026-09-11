import { submit, redirect, step, Self, Condition, Transformer, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import { saveDraftAnswers } from './effects'
import {
  GovUKTextInput,
  GovUKButton,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

const fullNameField = GovUKTextInput({
  code: 'fullName',
  label: {
    text: 'What is your name?',
    classes: GovUKUtilityClasses.Label.Large,
    isPageHeading: true,
  },
  autocomplete: 'name',
  classes: GovUKUtilityClasses.Input.Width20,
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your name',
    }),
    validation({
      condition: Self().match(Condition.String.HasMaxLength(100)),
      message: 'Name must be 100 characters or less',
    }),
  ],
})

const continueButton = GovUKButton({ text: 'Continue' })

export const yourNameStep = step({
  code: 'your-name',
  path: '/your-name',
  title: 'What is your name?',
  // Entry point that the resume walk evaluates from — when the user has
  // answered this step, resume skips past it to the next unanswered step.
  reachability: { entryWhen: true },
  blocks: [fullNameField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        // Persist progress so the user can leave and resume later
        effects: [saveDraftAnswers()],
        next: [redirect({ goto: 'your-role' })],
      },
    }),
  ],
})
