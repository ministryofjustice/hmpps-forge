import { Self, Condition, validation, submit, redirect, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKRadioInput, GovUKButton, GovUKHeading } from '@ministryofjustice/hmpps-forge/govuk-components'
import { setAnswer, saveDraftAnswers } from './effects'

const heading = GovUKHeading({
  text: 'Which day would you prefer to visit?',
  size: 'l',
})

const dayField = GovUKRadioInput({
  code: 'preferredDay',
  fieldset: {
    legend: {
      text: 'Preferred day',
      classes: 'govuk-fieldset__legend--m',
    },
  },
  items: [
    { value: 'monday', text: 'Monday' },
    { value: 'wednesday', text: 'Wednesday' },
    { value: 'friday', text: 'Friday' },
    { value: 'saturday', text: 'Saturday' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select a preferred day',
      submissionOnly: true,
    }),
  ],
})

const continueButton = GovUKButton({ text: 'Continue' })

export const preferredDayStep = step({
  code: 'preferred-day',
  path: '/preferred-day',
  title: 'Preferred day',
  // Entry point for this child journey — linked from the task list hub
  reachability: { entryWhen: true },
  // Override backlink to point to the task list hub in the parent journey
  backlink: '../tasks',
  blocks: [heading, dayField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [
          // Mark section as started
          setAnswer('visitPreferencesStatus', 'in-progress'),
          saveDraftAnswers(),
        ],
        // Next step within this child journey
        next: [redirect({ goto: 'visit-type' })],
      },
    }),
  ],
})
