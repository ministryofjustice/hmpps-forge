import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKSummaryList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: Data('stationName'),
  size: 'l',
})

export const details = GovUKSummaryList({
  rows: [
    {
      key: { text: 'Lines' },
      value: { text: Data('stationLines') },
    },
    {
      key: { text: 'Zone' },
      value: { text: Data('stationZone') },
    },
    {
      key: { text: 'Opened' },
      value: { text: Data('stationOpened') },
    },
  ],
})

export const description = GovUKBody({
  text: Data('stationDescription'),
})

export const backButton = GovUKLinkButton({
  text: 'Back to search',
  href: '/forge-developer-guide/patterns/demos/search-and-select/search',
  classes: 'govuk-button--secondary',
})
