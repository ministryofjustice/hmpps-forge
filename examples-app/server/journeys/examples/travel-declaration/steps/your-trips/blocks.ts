import {
  Answer,
  Item,
  Iterator,
  Condition,
  Format,
  match,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock } from '@ministryofjustice/hmpps-forge/core/components'
import {
  GovUKSummaryList,
  GovUKHeading,
  GovUKInsetText,
  GovUKButton, GovUKButtonGroup,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Your trips',
  size: 'l',
})

const reasonLabel = (reason: Parameters<typeof match>[0]) =>
  match(reason)
    .branch(Condition.Equals('holiday'), 'Holiday')
    .branch(Condition.Equals('work'), 'Work or business')
    .branch(Condition.Equals('family'), 'Visiting family or friends')
    .branch(Condition.Equals('education'), 'Education or training')
    .branch(Condition.Equals('medical'), 'Medical treatment')
    .branch(Condition.Equals('other'), 'Other')
    .otherwise('')

// FORGE-EXAMPLE: CollectionBlock + Iterator.Map renders a GovUKSummaryList card for each trip.
// Each card uses Item() to reference the current trip's properties.
// The card actions include a Remove link that posts the trip index for removal.
export const tripCards = CollectionBlock({
  collection: Answer('trips').each(
    Iterator.Map(
      GovUKSummaryList({
        card: {
          title: { text: Item().path('country') },
          actions: {
            items: [
              {
                href: Format('your-trips?remove=%1', Item().index()),
                text: 'Remove',
                visuallyHiddenText: Item().path('country'),
              },
            ],
          },
        },
        rows: [
          {
            key: { text: 'Departure date' },
            value: { text: Item().path('departureDate') },
          },
          {
            key: { text: 'Return date' },
            value: { text: Item().path('returnDate') },
          },
          {
            key: { text: 'Reason' },
            value: { text: reasonLabel(Item().path('reason')) },
          },
        ],
      }),
    ),
  ),
  fallback: [GovUKInsetText({ text: 'You have not added any trips yet.' })],
})

export const buttonGroup = GovUKButtonGroup({
  buttons: [
    GovUKButton({
      text: 'Add another trip',
      classes: 'govuk-button--secondary',
      name: 'action',
      value: 'add-another',
    }),
    GovUKButton({
      text: 'Continue',
      name: 'action',
      value: 'continue',
    })
  ]
})
