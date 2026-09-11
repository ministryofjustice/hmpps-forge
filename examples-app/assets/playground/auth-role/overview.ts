import { Literal, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKHeading, GovUKBody, GovUKList, GovUKLinkButton } from '@ministryofjustice/hmpps-forge/govuk-components'

const heading = GovUKHeading({
  text: 'Require authentication / role',
  size: 'l',
  caption: 'Pattern',
})

const intro = GovUKBody({
  text: `A journey where some steps require the user to be authenticated and
  others require a specific role. Unauthenticated users are redirected to
  a login page. Users without the required role see a 403 error.`,
})

const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

const showsList = GovUKList({
  items: Literal([
    'An access guard that redirects unauthenticated users',
    'A step-level access hook that returns 403 for the wrong role',
    'Session() references in access hook conditions',
    'Composing multiple access hooks on a single step (auth + role)',
  ]),
  style: 'bullet',
})

const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/auth-role/login',
  isStartButton: true,
})

export const overviewStep = step({
  path: '/overview',
  title: 'Require authentication / role',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  blocks: [heading, intro, shows, showsList, startButton],
})
