import { Self, Condition, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKRadioInput,
  GovUKButton,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const contactPreferenceField = GovUKRadioInput({
  code: 'contactPreference',
  fieldset: {
    legend: {
      text: 'How would you prefer to be contacted?',
      classes: GovUKUtilityClasses.Fieldset.LargeLabel,
      isPageHeading: true,
    },
  },
  items: [
    { value: 'email', text: 'Email' },
    { value: 'phone', text: 'Phone' },
    { value: 'post', text: 'Post' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select how you would prefer to be contacted',
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
