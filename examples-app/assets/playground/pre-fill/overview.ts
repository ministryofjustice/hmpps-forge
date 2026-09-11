import { step, Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

const heading = GovUKHeading({
  text: 'Pre-fill from an external system',
  size: 'l',
  caption: 'Pattern',
})

const intro = GovUKBody({
  text: `A form page with a "Find address" button that simulates an external API call
  mid-journey and populates address fields with the response. The user can
  review or edit the pre-filled values before continuing.`,
})

const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

const showsList = GovUKList({
  items: Literal([
    'A grouped submit hook that triggers an API call on a button press without leaving the page',
    'Pre-filling form fields with the API response using setAnswer()',
    'Letting the user review and override pre-filled values before continuing',
    'Separating the lookup trigger from the main form submission',
  ]),
  style: 'bullet',
})

const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/pre-fill/find-address',
  isStartButton: true,
})

export const overviewStep = step({
  path: '/overview',
  title: 'Pre-fill from an external system',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  blocks: [heading, intro, shows, showsList, startButton],
})
