import { Data, Item, Iterator } from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock } from '@ministryofjustice/hmpps-forge/core/components'
import {
  GovUKHeading,
  GovUKBody,
  GovUKSummaryList,
  GovUKButton,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Check your answers',
})

export const memberSummaries = CollectionBlock({
  collection: Data('members').each(
    Iterator.Map(
      GovUKSummaryList({
        card: {
          title: { text: Item().path('memberName') },
        },
        rows: [
          {
            key: { text: 'Age' },
            value: { text: Item().path('memberAge') },
          },
        ],
      }),
    ),
  ),
  fallback: [],
})

export const changeLink = GovUKLinkButton({
  text: 'Change household members',
  href: 'household-members',
  classes: 'govuk-button--secondary',
})

export const confirmBody = GovUKBody({
  text: 'Selecting "Confirm" will save your answers.',
})

export const submitButton = GovUKButton({ text: 'Confirm' })
