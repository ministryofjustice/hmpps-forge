import { Self, Condition, validation, submit, redirect, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKRadioInput, GovUKButton, GovUKUtilityClasses } from '@ministryofjustice/hmpps-forge/govuk-components'
import { saveDraftAnswers } from './effects'

const contactPreferenceField = GovUKRadioInput({
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

const continueButton = GovUKButton({ text: 'Continue' })

export const contactPreferenceStep = step({
  code: 'contact-preference',
  path: '/contact-preference',
  title: 'How would you prefer to be contacted?',
  reachability: { entryWhen: true },
  blocks: [contactPreferenceField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [saveDraftAnswers()],
        next: [
          redirect({ goto: 'check-answers' }),
        ],
      },
    }),
  ],
})
