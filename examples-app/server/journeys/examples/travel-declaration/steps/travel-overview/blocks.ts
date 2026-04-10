import { Self, Condition, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKRadioInput,
  GovUKButton,
  GovukUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const hasTravelledField = GovUKRadioInput({
  code: 'hasTravelled',
  fieldset: {
    legend: {
      text: 'Have you travelled outside the UK in the last 5 years?',
      classes: GovukUtilityClasses.Fieldset.LargeLabel,
      isPageHeading: true,
    },
  },
  hint: { text: 'Include any trips for work, holidays, visiting family, or any other reason.' },
  items: [
    { value: 'yes', text: 'Yes' },
    { value: 'no', text: 'No' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select yes if you have travelled outside the UK in the last 5 years',
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
