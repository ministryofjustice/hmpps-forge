import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Require authentication / role',
  size: 'l',
  caption: 'Pattern',
})

export const intro = GovUKBody({
  text: `A journey where some steps require the user to be authenticated and
  others require a specific role. Unauthenticated users are redirected to
  a login page. Users without the required role see a 403 error.`,
})

export const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

export const showsList = GovUKList({
  items: Literal([
    'A reusable guard function that redirects unauthenticated users',
    'A step-level access hook that returns 403 for the wrong role',
    'Session() references in access hook conditions',
    'Composing multiple access hooks on a single step (auth + role)',
  ]),
  type: 'bullet',
})

export const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/forge-developer-guide/patterns/demos/auth-role/login',
  isStartButton: true,
})
