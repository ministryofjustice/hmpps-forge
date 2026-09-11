import { Answer, Transformer, submit, redirect, Condition, Data, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKHeading, GovUKBody, GovUKSummaryList, GovUKButton } from '@ministryofjustice/hmpps-forge/govuk-components'
import { saveAnswers, clearDraftAnswers } from './effects'

const heading = GovUKHeading({ text: 'Check your answers' })

// Each change link appends ?returnTo=check-answers so the question step
// knows to redirect back here after saving instead of continuing the
// linear flow.
const summaryList = GovUKSummaryList({
  rows: [
    {
      key: { text: 'Full name' },
      value: { text: Answer('fullName') },
      actions: {
        items: [
          {
            href: 'full-name?returnTo=check-answers',
            text: 'Change',
            visuallyHiddenText: 'full name',
          },
        ],
      },
    },
    {
      key: { text: 'Email address' },
      value: { text: Answer('emailAddress') },
      actions: {
        items: [
          {
            href: 'email-address?returnTo=check-answers',
            text: 'Change',
            visuallyHiddenText: 'email address',
          },
        ],
      },
    },
    {
      key: { text: 'Contact preference' },
      value: { text: Answer('contactPreference').pipe(Transformer.String.Capitalize()) },
      actions: {
        items: [
          {
            href: 'contact-preference?returnTo=check-answers',
            text: 'Change',
            visuallyHiddenText: 'contact preference',
          },
        ],
      },
    },
  ],
})

const confirmBody = GovUKBody({
  text: 'Selecting "Confirm" will save your answers.',
})

const submitButton = GovUKButton({ text: 'Confirm' })

export const checkAnswersStep = step({
  code: 'check-answers',
  path: '/check-answers',
  title: 'Check your answers',
  blocks: [heading, summaryList, confirmBody, submitButton],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [
          saveAnswers(),
          clearDraftAnswers(),
        ],
        next: [
          redirect({
            when: Data('savedAnswers').match(Condition.IsRequired()),
            goto: 'confirmation',
          }),
        ],
      },
    }),
  ],
})
