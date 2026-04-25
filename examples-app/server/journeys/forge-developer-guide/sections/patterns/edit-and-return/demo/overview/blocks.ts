import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Edit and return',
  size: 'l',
  caption: 'Pattern',
})

export const intro = GovUKBody({
  text: `A check-your-answers page with change links that jump the user to
  a specific step and return them to the summary after saving. The normal
  linear flow is preserved for first-time users; the return-to-summary
  behaviour only activates when arriving via a change link.`,
})

export const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

export const showsList = GovUKList({
  items: Literal([
    'Change links that append a ?returnTo=check-answers query parameter',
    'Conditional redirects that check Query("returnTo") before choosing the next step',
    'First-time users follow the linear flow; reviewers jump straight back to the summary',
    'A summary page with the GOV.UK summary list and change links',
    'Confirmation and reset after submission',
  ]),
  type: 'bullet',
})

export const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/forge-developer-guide/patterns/demos/edit-and-return/full-name',
  isStartButton: true,
})
