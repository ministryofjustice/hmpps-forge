import { Format, Session, Condition, submit, redirect, Post, step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKHeading, GovUKBody, GovUKInsetText, GovUKLinkButton, GovUKButton } from '@ministryofjustice/hmpps-forge/govuk-components'
import { simulateLogout } from './effects'

const heading = GovUKHeading({ text: 'Dashboard', size: 'l' })

const welcomeMessage = GovUKBody({
  text: Format('Signed in as %1 (role: %2).', Session('demoUser.name'), Session('demoUser.role')),
})

const viewerWarning = GovUKInsetText({
  text: "You are signed in as a viewer. The admin panel will be denied with a 403 error. You can return here from the error page.",
  visibleWhen: Session('demoUser.role').match(Condition.Equals('viewer')),
})

const adminLink = GovUKLinkButton({
  text: 'Go to admin panel',
  href: '/auth-role/admin-panel',
})

const logoutButton = GovUKButton({
  text: 'Log out',
  name: 'action',
  value: 'logout',
  classes: 'govuk-button--secondary',
})

export const dashboardStep = step({
  code: 'dashboard',
  path: '/dashboard',
  title: 'Dashboard',
  reachability: { entryWhen: true },
  onAccess: [
    access({
      next: [
        redirect({
          when: Session('demoUser').not.match(Condition.IsRequired()),
          goto: 'login',
        }),
      ],
    }),
  ],
  blocks: [heading, welcomeMessage, viewerWarning, adminLink, logoutButton],
  onSubmission: [
    submit({
      when: Post('action').match(Condition.Equals('logout')),
      validate: false,
      onAlways: {
        effects: [simulateLogout()],
        next: [redirect({ goto: 'login' })],
      },
    }),
  ],
})
