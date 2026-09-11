import { Self, Condition, validation, submit, redirect, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKRadioInput, GovUKButton, GovUKHeading } from '@ministryofjustice/hmpps-forge/govuk-components'
import { setAnswer, saveDraftAnswers } from './effects'

const heading = GovUKHeading({
  text: 'What type of visit do you want?',
  size: 'l',
})

const visitTypeField = GovUKRadioInput({
  code: 'visitType',
  fieldset: {
    legend: {
      text: 'Type of visit',
      classes: 'govuk-fieldset__legend--m',
    },
  },
  items: [
    { value: 'in-person', text: 'In person' },
    { value: 'video', text: 'Video call' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select a type of visit',
      submissionOnly: true,
    }),
  ],
})

const continueButton = GovUKButton({ text: 'Save and return' })

export const visitTypeStep = step({
  code: 'visit-type',
  path: '/visit-type',
  title: 'Visit type',
  blocks: [heading, visitTypeField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [
          // Mark section as complete
          setAnswer('visitPreferencesStatus', 'completed'),
          saveDraftAnswers(),
        ],
        // Return to task list hub in the parent journey
        next: [redirect({ goto: '../tasks' })],
      },
    }),
  ],
})
