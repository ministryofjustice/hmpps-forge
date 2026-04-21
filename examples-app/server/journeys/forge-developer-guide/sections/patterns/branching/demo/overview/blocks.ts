import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Branching based on an earlier answer',
  size: 'l',
  caption: 'Pattern',
})

export const intro = GovUKBody({
  text: `A sequential flow that routes the user down a different
  path based on an earlier answer. In this demo they pick how
  they want a visit to happen, and the next page asks only for
  the details relevant to that choice. All branches converge
  on a shared check-your-answers summary.`,
})

export const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

export const showsList = GovUKList({
  items: Literal([
    'A radio question whose answer drives the next step',
    "Conditional redirects in a submit hook's next array, with first-match semantics",
    'Three branch steps that each collect different information',
    'A summary whose key, value, and change link adapt to the branch the user took',
    'A confirmation panel that resets the pattern when revisited',
  ]),
  type: 'bullet',
})

export const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/forge-developer-guide/patterns/demos/branching/visit-type',
  isStartButton: true,
})
