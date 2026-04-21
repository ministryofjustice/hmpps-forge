import { Self, Condition, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKRadioInput,
  GovUKButton,
  GovUKHeading,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'What type of visit do you want?',
  size: 'l',
})

export const visitTypeField = GovUKRadioInput({
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

export const continueButton = GovUKButton({ text: 'Save and return' })
