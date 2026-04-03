import { Self, Condition, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKRadioInput,
  GovUKButton,
  GovukUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const locationField = GovUKRadioInput({
  code: 'location',
  fieldset: {
    legend: {
      text: 'Which office would you like to visit?',
      classes: GovukUtilityClasses.Fieldset.LargeLabel,
      isPageHeading: true,
    },
  },
  items: [
    { value: 'london', text: 'London' },
    { value: 'leeds', text: 'Leeds' },
    { value: 'bristol', text: 'Bristol' },
  ],
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Select an office location',
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
