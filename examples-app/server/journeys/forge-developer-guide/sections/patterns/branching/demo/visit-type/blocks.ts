import { Self, Condition, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKRadioInput,
  GovUKButton,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

// A plain radio with three options. The selected value drives the redirect in
// the step's submit hook, so the field only needs a required rule here.
export const visitTypeField = GovUKRadioInput({
  code: 'visitType',
  fieldset: {
    legend: {
      text: 'How would you like to meet?',
      classes: GovUKUtilityClasses.Fieldset.LargeLabel,
      isPageHeading: true,
    },
  },
  hint: { text: 'Pick the option that works best for you.' },
  items: [
    { value: 'in-person', text: 'In person' },
    { value: 'video', text: 'Video call' },
    { value: 'phone', text: 'Phone call' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select how you would like to meet',
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
