import {
  Answer,
  Item,
  Iterator,
  Loop,
  Format,
  match,
  Condition,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock } from '@ministryofjustice/hmpps-forge/core/components'
import {
  GovUKSummaryList,
  GovUKHeading,
  GovUKInsetText,
  GovUKButton,
  GovUKButtonGroup,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Your emergency contacts',
  size: 'l',
})

const relationshipLabel = (relationship: Parameters<typeof match>[0]) =>
  match(relationship)
    .branch(Condition.Equals('partner'), 'Partner')
    .branch(Condition.Equals('parent'), 'Parent')
    .branch(Condition.Equals('sibling'), 'Sibling')
    .branch(Condition.Equals('child'), 'Child')
    .branch(Condition.Equals('friend'), 'Friend')
    .branch(Condition.Equals('colleague'), 'Colleague')
    .branch(Condition.Equals('other'), 'Other')
    .otherwise('')

export const contactCards = CollectionBlock({
  collection: Answer('contacts').each(
    Iterator.Map(
      GovUKSummaryList({
        card: {
          title: { text: Item().path('contactName') },
          actions: {
            items: [
              {
                href: Format('edit-contact/%1', Loop.Index0()),
                text: 'Change',
                visuallyHiddenText: Item().path('contactName'),
              },
              {
                href: Format('your-contacts?remove=%1', Loop.Index0()),
                text: 'Remove',
                visuallyHiddenText: Item().path('contactName'),
              },
            ],
          },
        },
        rows: [
          {
            key: { text: 'Relationship' },
            value: { text: relationshipLabel(Item().path('contactRelationship')) },
          },
          {
            key: { text: 'Phone number' },
            value: { text: Item().path('contactPhone') },
          },
        ],
      }),
    ),
  ),
  fallback: [GovUKInsetText({ text: 'You have not added any emergency contacts yet.' })],
})

export const buttonGroup = GovUKButtonGroup({
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
