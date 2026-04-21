import { Self, Condition, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKRadioInput,
  GovUKButton,
  GovUKHeading,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Which day would you prefer to visit?',
  size: 'l',
})

export const dayField = GovUKRadioInput({
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

export const continueButton = GovUKButton({ text: 'Continue' })
