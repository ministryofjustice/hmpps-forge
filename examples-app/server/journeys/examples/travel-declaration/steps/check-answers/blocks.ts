import {
  Answer,
  Item,
  Iterator,
  Condition,
  match,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock } from '@ministryofjustice/hmpps-forge/core/components'
import {
  GovUKHeading,
  GovUKSummaryList,
  GovUKBody,
  GovUKButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Check your travel declaration',
  size: 'l',
})

export const overviewSummary = GovUKSummaryList({
  rows: [
    {
      key: { text: 'Travelled outside the UK' },
      value: {
        text: match(Answer('hasTravelled'))
          .branch(Condition.Equals('yes'), 'Yes')
          .branch(Condition.Equals('no'), 'No')
          .otherwise(''),
      },
      actions: {
        items: [
          {
            href: 'travel-overview',
            text: 'Change',
            visuallyHiddenText: 'whether you have travelled outside the UK',
          },
        ],
      },
    },
  ],
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

export const tripSummaryCards = CollectionBlock({
  collection: Answer('trips').each(
    Iterator.Map(
      GovUKSummaryList({
        card: {
          title: { text: Item().path('country') },
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
})

export const confirmationBody = GovUKBody({
  text: 'By submitting this declaration you are confirming that, to the best of your knowledge, the details you are providing are correct.',
})

export const submitButton = GovUKButton({ text: 'Submit declaration' })
