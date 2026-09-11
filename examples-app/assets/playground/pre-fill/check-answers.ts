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
      key: { text: 'Address line 1' },
      value: { text: Answer('addressLine1') },
      actions: {
        items: [{ href: 'find-address', text: 'Change', visuallyHiddenText: 'address line 1' }],
      },
    },
    {
      key: { text: 'Address line 2' },
      value: { text: Answer('addressLine2') },
      actions: {
        items: [{ href: 'find-address', text: 'Change', visuallyHiddenText: 'address line 2' }],
      },
    },
    {
      key: { text: 'Town or city' },
      value: { text: Answer('addressTown') },
      actions: {
        items: [{ href: 'find-address', text: 'Change', visuallyHiddenText: 'town or city' }],
      },
    },
    {
      key: { text: 'County' },
      value: { text: Answer('addressCounty') },
      actions: { items: [{ href: 'find-address', text: 'Change', visuallyHiddenText: 'county' }] },
    },
    {
      key: { text: 'Postcode' },
      value: { text: Answer('addressPostcode') },
      actions: {
        items: [{ href: 'find-address', text: 'Change', visuallyHiddenText: 'postcode' }],
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
