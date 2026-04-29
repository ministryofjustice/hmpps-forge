import { Answer, match, Condition } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKSummaryList,
  GovUKHeading,
  GovUKButton,
  GovUKBody,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Check your answers',
  size: 'l',
})

const relationshipLabel = match(Answer('relationship'))
  .branch(Condition.Equals('partner'), 'Partner or spouse')
  .branch(Condition.Equals('parent'), 'Parent')
  .branch(Condition.Equals('child'), 'Son or daughter')
  .branch(Condition.Equals('sibling'), 'Brother or sister')
  .branch(Condition.Equals('friend'), 'Friend')
  .branch(Condition.Equals('legal'), 'Legal representative')
  .branch(Condition.Equals('other'), 'Other')
  .otherwise('')

const dayLabel = match(Answer('preferredDay'))
  .branch(Condition.Equals('monday'), 'Monday')
  .branch(Condition.Equals('wednesday'), 'Wednesday')
  .branch(Condition.Equals('friday'), 'Friday')
  .branch(Condition.Equals('saturday'), 'Saturday')
  .otherwise('')

const visitTypeLabel = match(Answer('visitType'))
  .branch(Condition.Equals('in-person'), 'In person')
  .branch(Condition.Equals('video'), 'Video call')
  .otherwise('')

export const yourDetailsSummary = GovUKSummaryList({
  card: { title: { text: 'Your details' } },
  rows: [
    {
      key: { text: 'Full name' },
      value: { text: Answer('visitorName') },
      actions: {
        items: [
          { href: 'your-details/your-name', text: 'Change', visuallyHiddenText: 'your name' },
        ],
      },
    },
    {
      key: { text: 'Relationship' },
      value: { text: relationshipLabel },
      actions: {
        items: [
          {
            href: 'your-details/relationship',
            text: 'Change',
            visuallyHiddenText: 'your relationship',
          },
        ],
      },
    },
  ],
})

export const visitPreferencesSummary = GovUKSummaryList({
  card: { title: { text: 'Visit preferences' } },
  rows: [
    {
      key: { text: 'Preferred day' },
      value: { text: dayLabel },
      actions: {
        items: [
          {
            href: 'visit-preferences/preferred-day',
            text: 'Change',
            visuallyHiddenText: 'preferred day',
          },
        ],
      },
    },
    {
      key: { text: 'Type of visit' },
      value: { text: visitTypeLabel },
      actions: {
        items: [
          {
            href: 'visit-preferences/visit-type',
            text: 'Change',
            visuallyHiddenText: 'type of visit',
          },
        ],
      },
    },
  ],
})

export const additionalNeedsSummary = GovUKSummaryList({
  card: { title: { text: 'Additional needs' } },
  rows: [
    {
      key: { text: 'Requirements' },
      value: { text: Answer('additionalNeeds') },
      actions: {
        items: [
          { href: 'additional-needs', text: 'Change', visuallyHiddenText: 'additional needs' },
        ],
      },
    },
  ],
})

export const confirmBody = GovUKBody({
  text: 'By submitting this application you confirm that the information you have provided is correct.',
})

export const submitButton = GovUKButton({ text: 'Submit application' })
