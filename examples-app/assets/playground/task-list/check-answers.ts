import {
  Answer,
  match,
  Condition,
  submit,
  redirect,
  Data,
  and,
  step,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKSummaryList, GovUKHeading, GovUKButton, GovUKBody } from '@ministryofjustice/hmpps-forge/govuk-components'
import { saveAnswers, clearDraftAnswers } from './effects'

const heading = GovUKHeading({
  text: 'Check your answers',
  size: 'l',
})

const relationshipLabel = match(Answer('relationship'))
  .case('partner', 'Partner or spouse')
  .case('parent', 'Parent')
  .case('child', 'Son or daughter')
  .case('sibling', 'Brother or sister')
  .case('friend', 'Friend')
  .case('legal', 'Legal representative')
  .case('other', 'Other')
  .otherwise('')

const dayLabel = match(Answer('preferredDay'))
  .case('monday', 'Monday')
  .case('wednesday', 'Wednesday')
  .case('friday', 'Friday')
  .case('saturday', 'Saturday')
  .otherwise('')

const visitTypeLabel = match(Answer('visitType'))
  .case('in-person', 'In person')
  .case('video', 'Video call')
  .otherwise('')

const yourDetailsSummary = GovUKSummaryList({
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

const visitPreferencesSummary = GovUKSummaryList({
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

const additionalNeedsSummary = GovUKSummaryList({
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

const confirmBody = GovUKBody({
  text: 'By submitting this application you confirm that the information you have provided is correct.',
})

const submitButton = GovUKButton({ text: 'Submit application' })

// Only reachable once every section is complete
const allComplete = and(
  Answer('yourDetailsStatus').match(Condition.Equals('completed')),
  Answer('visitPreferencesStatus').match(Condition.Equals('completed')),
  Answer('additionalNeedsStatus').match(Condition.Equals('completed')),
)

export const checkAnswersStep = step({
  code: 'check-answers',
  path: '/check-answers',
  title: 'Check your answers',
  // Gated entry — all sections must be done before the user can review
  reachability: { entryWhen: allComplete },
  backlink: 'tasks',
  blocks: [
    heading,
    yourDetailsSummary,
    visitPreferencesSummary,
    additionalNeedsSummary,
    confirmBody,
    submitButton,
  ],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [
          // Save the confirmed record before clearing drafts
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
