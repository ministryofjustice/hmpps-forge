import { Answer, Condition, match } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKSummaryList,
  GovUKButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Check your answers',
})

// The radio value is machine-readable ('social-media'), so map it to a display
// label with match(). The two follow-up rows use visibleWhen so they only show
// when the user picked the option that revealed them on the previous step.
const heardFromLabel = match(Answer('heardFrom'))
  .branch(Condition.Equals('search-engine'), 'Search engine')
  .branch(Condition.Equals('social-media'), 'Social media')
  .branch(Condition.Equals('friend-or-colleague'), 'Friend or colleague')
  .branch(Condition.Equals('other'), 'Other')
  .otherwise('')

export const summaryList = GovUKSummaryList({
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

export const confirmBody = GovUKBody({
  text: 'Selecting "Confirm" will save your answers.',
})

export const submitButton = GovUKButton({ text: 'Confirm' })
