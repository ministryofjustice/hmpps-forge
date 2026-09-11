import { Self, Condition, validation, submit, redirect, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKSelectInput,
  GovUKButton,
  GovUKHeading,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import { setAnswer, saveDraftAnswers } from './effects'

const heading = GovUKHeading({
  text: 'What is your relationship to the prisoner?',
  size: 'l',
})

const relationshipField = GovUKSelectInput({
  code: 'relationship',
  label: {
    text: 'Relationship',
    classes: GovUKUtilityClasses.Label.Medium,
  },
  items: [
    { value: '', text: 'Choose a relationship' },
    { value: 'partner', text: 'Partner or spouse' },
    { value: 'parent', text: 'Parent' },
    { value: 'child', text: 'Son or daughter' },
    { value: 'sibling', text: 'Brother or sister' },
    { value: 'friend', text: 'Friend' },
    { value: 'legal', text: 'Legal representative' },
    { value: 'other', text: 'Other' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select your relationship to the prisoner',
      submissionOnly: true,
    }),
  ],
})

const continueButton = GovUKButton({ text: 'Save and return' })

export const relationshipStep = step({
  code: 'relationship',
  path: '/relationship',
  title: 'Relationship',
  blocks: [heading, relationshipField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [
          // Mark section as complete
          setAnswer('yourDetailsStatus', 'completed'),
          saveDraftAnswers(),
        ],
        // Return to task list hub in the parent journey
        next: [redirect({ goto: '../tasks' })],
      },
    }),
  ],
})
