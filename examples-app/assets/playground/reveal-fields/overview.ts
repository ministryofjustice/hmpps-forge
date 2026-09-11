import { Literal, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKHeading, GovUKBody, GovUKList, GovUKLinkButton } from '@ministryofjustice/hmpps-forge/govuk-components'

const heading = GovUKHeading({
  text: 'Reveal fields',
  size: 'l',
  caption: 'Pattern',
})

const intro = GovUKBody({
  text: `A single-page question that reveals an extra input when
  the user picks an option that needs more detail. In this demo
  they pick how they heard about the service, and 2 of the 4
  options ask a follow-up question inline.`,
})

const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

const showsList = GovUKList({
  items: Literal([
    'A radio field with a `block` attached to specific options',
    'Follow-up inputs that only validate when their parent option is selected (dependentWhen)',
    'A single step that captures the choice and the follow-up together',
    'A summary that shows the follow-up answer only when it applies',
  ]),
  style: 'bullet',
})

const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/reveal-fields/heard-from',
  isStartButton: true,
})

export const overviewStep = step({
  path: '/overview',
  title: 'Reveal fields',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  blocks: [heading, intro, shows, showsList, startButton],
})
