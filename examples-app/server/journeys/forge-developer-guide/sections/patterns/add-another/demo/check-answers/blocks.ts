import {
  Answer,
  Item,
  Iterator,
  match,
  Condition,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock } from '@ministryofjustice/hmpps-forge/core/components'
import {
  GovUKSummaryList,
  GovUKHeading,
  GovUKBody,
  GovUKButton,
  GovUKInsetText,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Check your answers',
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

export const contactSummaryCards = CollectionBlock({
  collection: Answer('contacts').each(
    Iterator.Map(
      GovUKSummaryList({
        card: {
          title: { text: Item().path('contactName') },
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
  fallback: [GovUKInsetText({ text: 'You have not added any emergency contacts.' })],
})

export const confirmBody = GovUKBody({
  text: 'Selecting "Confirm" will save your emergency contacts.',
})

export const submitButton = GovUKButton({ text: 'Confirm' })
