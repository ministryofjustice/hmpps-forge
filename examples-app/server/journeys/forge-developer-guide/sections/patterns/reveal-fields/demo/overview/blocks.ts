import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Reveal fields',
  size: 'l',
  caption: 'Pattern',
})

export const intro = GovUKBody({
  text: `A single-page question that reveals an extra input when
  the user picks an option that needs more detail. In this demo
  they pick how they heard about the service, and 2 of the 4
  options ask a follow-up question inline.`,
})

export const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

export const showsList = GovUKList({
  items: Literal([
    'A radio field with a `block` attached to specific options',
    'Follow-up inputs that only validate when their parent option is selected (dependentWhen)',
    'A single step that captures the choice and the follow-up together',
    'A summary that shows the follow-up answer only when it applies',
  ]),
  type: 'bullet',
})

export const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/forge-developer-guide/patterns/demos/reveal-fields/heard-from',
  isStartButton: true,
})
