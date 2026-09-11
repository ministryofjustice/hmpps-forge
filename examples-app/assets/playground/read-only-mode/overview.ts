import { step, Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

const heading = GovUKHeading({
  text: 'Read-only mode',
  size: 'l',
  caption: 'Pattern',
})

const intro = GovUKBody({
  text: `A single page that renders different content depending on the
  user's role. Admins see editable form fields and a save button.
  Viewers see the same data as a read-only summary list. Both roles
  share the same step definition — only the blocks differ via
  visibleWhen conditions.`,
})

const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

const showsList = GovUKList({
  items: Literal([
    'visibleWhen conditions driven by Session() role checks',
    'Two views of the same data on a single step: editable fields for admins, a summary list for viewers',
    'Pre-loaded contact records persisted separately from the simulated login session',
    'Composing authentication and role guards with conditional rendering',
  ]),
  style: 'bullet',
})

const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/read-only-mode/login',
  isStartButton: true,
})

export const overviewStep = step({
  path: '/overview',
  title: 'Read-only mode',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  blocks: [heading, intro, shows, showsList, startButton],
})
