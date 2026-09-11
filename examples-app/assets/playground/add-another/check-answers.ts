import { Answer, Loop, Iterator, match, Condition, submit, redirect, Data, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock } from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKSummaryList, GovUKHeading, GovUKBody, GovUKButton, GovUKInsetText } from '@ministryofjustice/hmpps-forge/govuk-components'
import { saveAnswers, clearDraftAnswers } from './effects'

const heading = GovUKHeading({
  text: 'Check your answers',
})

const relationshipLabel = (relationship: Parameters<typeof match>[0]) =>
  match(relationship)
    .case('partner', 'Partner')
    .case('parent', 'Parent')
    .case('sibling', 'Sibling')
    .case('child', 'Child')
    .case('friend', 'Friend')
    .case('colleague', 'Colleague')
    .case('other', 'Other')
    .otherwise('')

const contactSummaryCards = CollectionBlock({
  collection: Answer('contacts').each(
    Iterator.Map(
      GovUKSummaryList({
        card: {
          title: { text: Loop.Item().path('contactName') },
        },
        rows: [
          {
            key: { text: 'Relationship' },
            value: { text: relationshipLabel(Loop.Item().path('contactRelationship')) },
          },
          {
            key: { text: 'Phone number' },
            value: { text: Loop.Item().path('contactPhone') },
          },
        ],
      }),
    ),
  ),
  fallback: [GovUKInsetText({ text: 'You have not added any emergency contacts.' })],
})

const confirmBody = GovUKBody({
  text: 'Selecting "Confirm" will save your emergency contacts.',
})

const submitButton = GovUKButton({ text: 'Confirm' })

export const checkAnswersStep = step({
  code: 'check-answers',
  path: '/check-answers',
  title: 'Check your answers',
  blocks: [heading, contactSummaryCards, confirmBody, submitButton],
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
