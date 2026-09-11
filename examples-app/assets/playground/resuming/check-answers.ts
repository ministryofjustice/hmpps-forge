import { submit, redirect, Condition, Data, step, Answer } from '@ministryofjustice/hmpps-forge/core/authoring'
import { saveAnswers, clearDraftAnswers } from './effects'
import {
  GovUKHeading,
  GovUKBody,
  GovUKSummaryList,
  GovUKButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

const heading = GovUKHeading({
  text: 'Check your answers',
})

const summaryList = GovUKSummaryList({
  rows: [
    {
      key: { text: 'Name' },
      value: { text: Answer('fullName') },
      actions: { items: [{ href: 'your-name', text: 'Change', visuallyHiddenText: 'name' }] },
    },
    {
      key: { text: 'Role' },
      value: { text: Answer('role') },
      actions: { items: [{ href: 'your-role', text: 'Change', visuallyHiddenText: 'role' }] },
    },
  ],
})

const confirmBody = GovUKBody({
  text: 'Selecting "Confirm" will save your answers.',
})

const submitButton = GovUKButton({ text: 'Confirm', name: 'action', value: 'confirm' })

// Resume stops at the summary until the confirmed record has been saved.
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
