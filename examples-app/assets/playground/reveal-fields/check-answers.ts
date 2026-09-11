import { Answer, Condition, match, submit, redirect, Data, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKHeading, GovUKBody, GovUKSummaryList, GovUKButton } from '@ministryofjustice/hmpps-forge/govuk-components'
import { saveAnswers, clearDraftAnswers } from './effects'

const heading = GovUKHeading({
  text: 'Check your answers',
})

// The radio value is machine-readable ('social-media'), so map it to a display
// label with match(). The two follow-up rows use visibleWhen so they only show
// when the user picked the option that revealed them on the previous step.
const heardFromLabel = match(Answer('heardFrom'))
  .case('search-engine', 'Search engine')
  .case('social-media', 'Social media')
  .case('friend-or-colleague', 'Friend or colleague')
  .case('other', 'Other')
  .otherwise('')

const summaryList = GovUKSummaryList({
  rows: [
    {
      key: { text: 'How you heard about us' },
      value: { text: heardFromLabel },
      actions: {
        items: [
          { href: 'heard-from', text: 'Change', visuallyHiddenText: 'how you heard about us' },
        ],
      },
    },
    {
      key: { text: 'Platform' },
      value: { text: Answer('socialMediaSource') },
      actions: {
        items: [{ href: 'heard-from', text: 'Change', visuallyHiddenText: 'the platform' }],
      },
      visibleWhen: Answer('heardFrom').match(Condition.Equals('social-media')),
    },
    {
      key: { text: 'Details' },
      value: { text: Answer('otherSource') },
      actions: {
        items: [{ href: 'heard-from', text: 'Change', visuallyHiddenText: 'the details' }],
      },
      visibleWhen: Answer('heardFrom').match(Condition.Equals('other')),
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
