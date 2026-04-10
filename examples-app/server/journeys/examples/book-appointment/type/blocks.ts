import { Self, Condition, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKRadioInput,
  GovUKButton,
  GovukUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const appointmentTypeField = GovUKRadioInput({
  code: 'appointmentType',
  fieldset: {
    legend: {
      text: 'What type of appointment do you need?',
      classes: GovukUtilityClasses.Fieldset.LargeLabel,
      isPageHeading: true,
    },
  },
  items: [
    { value: 'in-person', text: 'In person' },
    { value: 'phone', text: 'Phone call' },
    { value: 'video', text: 'Video call' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select an appointment type',
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
