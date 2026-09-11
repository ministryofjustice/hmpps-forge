import { submit, redirect, step, Self, Condition, Transformer, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import { saveDraftAnswers } from './effects'
import {
  GovUKTextInput,
  GovUKButton,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

// A single-question page uses the field's label as the page heading.
// isPageHeading + size 'l' gives the correct GOV.UK spacing for
// one-question-per-page flows.
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

// Each question page validates on submit, saves the answer into the session,
// and redirects to the next question. Because the journey loads answers on
// access, returning users see their previous input already filled in.
export const yourNameStep = step({
  code: 'your-name',
  path: '/your-name',
  title: 'What is your name?',
  reachability: { entryWhen: true },
  blocks: [fullNameField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [saveDraftAnswers()],
        next: [redirect({ goto: 'your-role' })],
      },
    }),
  ],
})
