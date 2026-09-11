import { Literal, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKHeading, GovUKBody, GovUKList, GovUKLinkButton } from '@ministryofjustice/hmpps-forge/govuk-components'

const heading = GovUKHeading({
  text: 'Branching based on an earlier answer',
  size: 'l',
  caption: 'Pattern',
})

const intro = GovUKBody({
  text: `A sequential flow that routes the user down a different
  path based on an earlier answer. In this demo they pick how
  they want a visit to happen, and the next page asks only for
  the details relevant to that choice. All branches converge
  on a shared check-your-answers summary.`,
})

const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

const showsList = GovUKList({
  items: Literal([
    'A radio question whose answer drives the next step',
    "Conditional redirects in a submit hook's next array, with first-match semantics",
    'Three branch steps that each collect different information',
    'A summary whose key, value, and change link adapt to the branch the user took',
    'A confirmation panel with a button to restart the pattern',
  ]),
  style: 'bullet',
})

const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/branching/visit-type',
  isStartButton: true,
})

export const overviewStep = step({
  path: '/overview',
  title: 'Branching based on an earlier answer',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  blocks: [heading, intro, shows, showsList, startButton],
})
