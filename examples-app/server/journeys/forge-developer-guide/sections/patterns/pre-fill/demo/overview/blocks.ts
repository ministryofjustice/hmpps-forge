import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Pre-fill from an external system',
  size: 'l',
  caption: 'Pattern',
})

export const intro = GovUKBody({
  text: `A form page with a "Find address" button that calls an external API
  mid-journey and populates address fields with the response. The user can
  review or edit the pre-filled values before continuing.`,
})

export const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

export const showsList = GovUKList({
  items: Literal([
    'A grouped submit hook that triggers an API call on a button press without leaving the page',
    'Pre-filling form fields with the API response using setAnswer()',
    'Letting the user review and override pre-filled values before continuing',
    'Separating the lookup trigger from the main form submission',
  ]),
  type: 'bullet',
})

export const startButton = GovUKLinkButton({
  text: 'See the demo',
  href: '/forge-developer-guide/patterns/demos/pre-fill/find-address',
  isStartButton: true,
})
