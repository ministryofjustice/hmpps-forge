import { Data, Format, access, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKSummaryList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import { loadStation } from './effects'

const heading = GovUKHeading({
  text: Data('stationName'),
  size: 'l',
})

const details = GovUKSummaryList({
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

const description = GovUKBody({
  text: Data('stationDescription'),
})

const backButton = GovUKLinkButton({
  text: 'Back to list',
  href: Format(
    '/pagination/list?page=%1',
    Data('stationPage'),
  ),
  classes: 'govuk-button--secondary',
})

export const detailStep = step({
  code: 'detail',
  path: '/detail/:index',
  title: 'Station details',
  reachability: { entryWhen: true },
  onAccess: [
    access({
      effects: [loadStation()],
    }),
  ],
  blocks: [heading, details, description, backButton],
})
