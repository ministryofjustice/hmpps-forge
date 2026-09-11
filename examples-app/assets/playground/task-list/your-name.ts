import { Self, Condition, validation, submit, redirect, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKTextInput,
  GovUKButton,
  GovUKHeading,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import { setAnswer, saveDraftAnswers } from './effects'

const heading = GovUKHeading({
  text: 'What is your full name?',
  size: 'l',
})

const nameField = GovUKTextInput({
  code: 'visitorName',
  label: {
    text: 'Full name',
    classes: GovUKUtilityClasses.Label.Medium,
  },
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your full name',
      submissionOnly: true,
    }),
  ],
})

const continueButton = GovUKButton({ text: 'Continue' })

export const yourNameStep = step({
  code: 'your-name',
  path: '/your-name',
  title: 'Your name',
  // Entry point for this child journey — linked from the task list hub
  reachability: { entryWhen: true },
  // Override backlink to point to the task list hub in the parent journey
  backlink: '../tasks',
  blocks: [heading, nameField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [
          // Mark section as started
          setAnswer('yourDetailsStatus', 'in-progress'),
          saveDraftAnswers(),
        ],
        // Next step within this child journey
        next: [redirect({ goto: 'relationship' })],
      },
    }),
  ],
})
