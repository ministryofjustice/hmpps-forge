import { Answer, Transformer, submit, redirect, Condition, Data, step, generator } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKHeading, GovUKBody, GovUKSummaryList, GovUKButton } from '@ministryofjustice/hmpps-forge/govuk-components'
import { saveAnswers, clearDraftAnswers } from './effects'

const heading = GovUKHeading({
  text: 'Check your answers',
})

// Date of birth comes out of GovUKDateInputFull as an ISO string. ToDate() parses
// it and Transformer.Date.Format renders a friendly long-date for display. The
// underlying answer is untouched - the transform happens at render time.
const dateOfBirthDisplay = Answer('dateOfBirth').pipe(
  Transformer.String.ToDate(),
  Transformer.Date.Format('D MMMM YYYY'),
)

// Plain text keeps user-entered address lines escaped by the summary component.
const formatAddress = generator({
  name: 'FormatAddress',
  factory: () => (...lines: string[]) => lines.filter(Boolean).join(', '),
})

const addressDisplay = formatAddress(
  Answer('addressLine1'),
  Answer('addressLine2'),
  Answer('addressTown'),
  Answer('addressPostcode'),
)

const summaryList = GovUKSummaryList({
  rows: [
    {
      key: { text: 'Date of birth' },
      value: { text: dateOfBirthDisplay },
      actions: {
        items: [{ href: 'date-of-birth', text: 'Change', visuallyHiddenText: 'date of birth' }],
      },
    },
    {
      key: { text: 'Address' },
      value: { text: addressDisplay },
      actions: {
        items: [{ href: 'address', text: 'Change', visuallyHiddenText: 'address' }],
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
