import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Load reference data on access',
  size: 'l',
  caption: 'Pattern',
})

export const intro = GovUKBody({
  text: `An access hook loads data from an external source before the page renders.
  The loaded values are available to blocks through Data() expressions. Each page
  load fetches fresh data, simulating a call to a live API.`,
})

export const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

export const showsList = GovUKList({
  items: Literal([
    'An effect that runs on every GET request via an access hook',
    'Data set by the effect and consumed by blocks through Data() references',
    'Fresh data on each page load, simulating a real API call',
    'A grid layout displaying the loaded values as a dashboard',
  ]),
  type: 'bullet',
})

export const startButton = GovUKLinkButton({
  text: 'See the demo',
  href: '/forge-developer-guide/patterns/demos/load-reference-data/draw',
  isStartButton: true,
})
