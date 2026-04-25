import { Answer, Transformer } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKSummaryList,
  GovUKButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({ text: 'Check your answers' })

// Each change link appends ?returnTo=check-answers so the question step
// knows to redirect back here after saving instead of continuing the
// linear flow.
export const summaryList = GovUKSummaryList({
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

export const confirmBody = GovUKBody({
  text: 'Selecting "Confirm" will save your answers.',
})

export const submitButton = GovUKButton({ text: 'Confirm' })
