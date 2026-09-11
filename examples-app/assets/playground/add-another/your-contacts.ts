import { Answer, Loop, Iterator, Format, match, Condition, submit, redirect, validation, Post, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock } from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKSummaryList, GovUKHeading, GovUKInsetText, GovUKButton, GovUKButtonGroup } from '@ministryofjustice/hmpps-forge/govuk-components'
import { saveDraftAnswers } from './effects'

const heading = GovUKHeading({
  text: 'Your emergency contacts',
  size: 'l',
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

const contactCards = CollectionBlock({
  collection: Answer('contacts').each(
    Iterator.Map(
      GovUKSummaryList({
        card: {
          title: { text: Loop.Item().path('contactName') },
          actions: {
            items: [
              {
                href: Format('edit-contact/%1', Loop.Index0()),
                text: 'Change',
                visuallyHiddenText: Loop.Item().path('contactName'),
              },
              {
                href: Format('delete-contact/%1', Loop.Index0()),
                text: 'Remove',
                visuallyHiddenText: Loop.Item().path('contactName'),
              },
            ],
          },
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
  fallback: [GovUKInsetText({ text: 'You have not added any emergency contacts yet.' })],
})

const buttonGroup = GovUKButtonGroup({
  buttons: [
    GovUKButton({
      text: 'Add another contact',
      classes: 'govuk-button--secondary',
      name: 'action',
      value: 'add-another',
    }),
    GovUKButton({
      text: 'Continue',
      name: 'action',
      value: 'continue',
    }),
  ],
})

export const yourContactsStep = step({
  code: 'your-contacts',
  path: '/your-contacts',
  title: 'Your emergency contacts',
  reachability: { entryWhen: true },
  blocks: [heading, contactCards, buttonGroup],
  // Step-level validation — requires at least one contact before the user
  // can continue. Also feeds into reachability: downstream steps are
  // unreachable while this rule fails.
  validWhen: [
    validation({
      condition: Answer('contacts').match(Condition.IsRequired()),
      message: 'Add at least one emergency contact',
    }),
  ],
  onSubmission: [
    // "Add another" skips validation so the user is never blocked from
    // adding their first contact when the collection is empty.
    submit({
      when: Post('action').match(Condition.Equals('add-another')),
      validate: false,
      onAlways: {
        effects: [saveDraftAnswers()],
        next: [redirect({ goto: 'add-contact' })],
      },
    }),
    // "Continue" validates — triggers the step-level validWhen rule above.
    submit({
      when: Post('action').match(Condition.Equals('continue')),
      validate: true,
      onValid: {
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
})
