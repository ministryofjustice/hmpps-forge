import { Self, Condition, validation, submit, redirect, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKRadioInput, GovUKButton, GovUKUtilityClasses } from '@ministryofjustice/hmpps-forge/govuk-components'
import { saveDraftAnswers } from '../effects'

const locationField = GovUKRadioInput({
  code: 'location',
  fieldset: {
    legend: {
      text: 'Which office would you like to visit?',
      classes: GovUKUtilityClasses.Fieldset.LargeLabel,
      isPageHeading: true,
    },
  },
  items: [
    { value: 'london', text: 'London' },
    { value: 'manchester', text: 'Manchester' },
    { value: 'cardiff', text: 'Cardiff' },
    { value: 'edinburgh', text: 'Edinburgh' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select an office',
    }),
  ],
})

const continueButton = GovUKButton({ text: 'Continue' })

// Branch step for the in-person path. Only reachable when visitType is
// 'in-person', because that is the only case where visit-type's submit hook
// redirects here. Forge's reachability keeps users off this step via the URL
// if their earlier answer was different.
export const locationStep = step({
  code: 'location',
  path: '/location',
  title: 'Which office would you like to visit?',
  blocks: [locationField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [saveDraftAnswers('branching')],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
})
