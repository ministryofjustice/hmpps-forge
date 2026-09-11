import {
  Data,
  Loop,
  Iterator,
  Answer,
  submit,
  redirect,
  Condition,
  step,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock } from '@ministryofjustice/hmpps-forge/core/components'
import {
  GovUKHeading,
  GovUKBody,
  GovUKSummaryList,
  GovUKButton,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import { saveAnswers, clearDraftAnswers } from './effects'

const heading = GovUKHeading({
  text: 'Check your answers',
})

const memberSummaries = CollectionBlock({
  collection: Answer('members').each(
    Iterator.Map(
      GovUKSummaryList({
        card: {
          title: { text: Loop.Item().path('memberName') },
        },
        rows: [
          {
            key: { text: 'Age' },
            value: { text: Loop.Item().path('memberAge') },
          },
        ],
      }),
    ),
  ),
  fallback: [],
})

const changeLink = GovUKLinkButton({
  text: 'Change household members',
  href: 'household-members',
  classes: 'govuk-button--secondary',
})

const confirmBody = GovUKBody({
  text: 'Selecting "Confirm" will save your answers.',
})

const submitButton = GovUKButton({ text: 'Confirm' })


export const checkAnswersStep = step({
  code: 'check-answers',
  path: '/check-answers',
  title: 'Check your answers',
  blocks: [heading, memberSummaries, changeLink, confirmBody, submitButton],
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
