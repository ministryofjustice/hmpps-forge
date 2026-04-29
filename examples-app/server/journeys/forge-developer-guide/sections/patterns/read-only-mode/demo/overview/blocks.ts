import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Read-only mode',
  size: 'l',
  caption: 'Pattern',
})

export const intro = GovUKBody({
  text: `A single page that renders different content depending on the
  user's role. Admins see editable form fields and a save button.
  Viewers see the same data as a read-only summary list. Both roles
  share the same step definition — only the blocks differ via
  visibleWhen conditions.`,
})

export const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

export const showsList = GovUKList({
  items: Literal([
    'visibleWhen conditions driven by Session() role checks',
    'Two views of the same data on a single step: editable fields for admins, a summary list for viewers',
    'Pre-loaded record data seeded at login and persisted through draft answers',
    'Composing authentication and role guards with conditional rendering',
  ]),
  type: 'bullet',
})

export const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/forge-developer-guide/patterns/demos/read-only-mode/login',
  isStartButton: true,
})
