import { Self, Condition, validation, submit, redirect, Answer, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKRadioInput, GovUKButton, GovUKUtilityClasses } from '@ministryofjustice/hmpps-forge/govuk-components'
import { saveDraftAnswers } from './effects'

// A plain radio with three options. The selected value drives the redirect in
// the step's submit hook, so the field only needs a required rule here.
const visitTypeField = GovUKRadioInput({
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

const continueButton = GovUKButton({ text: 'Continue' })

// The branching happens here. After saving, the next[] array is evaluated in
// order: the first redirect whose `when` matches wins. Only one of them will
// fire per submit.
export const visitTypeStep = step({
  code: 'visit-type',
  path: '/visit-type',
  title: 'How would you like to meet?',
  reachability: { entryWhen: true },
  blocks: [visitTypeField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [saveDraftAnswers()],
        next: [
          redirect({
            when: Answer('visitType').match(Condition.Equals('in-person')),
            goto: 'location',
          }),
          redirect({
            when: Answer('visitType').match(Condition.Equals('video')),
            goto: 'video-email',
          }),
          redirect({
            when: Answer('visitType').match(Condition.Equals('phone')),
            goto: 'phone-number',
          }),
        ],
      },
    }),
  ],
})
