import { GovUKHeading, GovUKBody, GovUKLinkButton } from '@ministryofjustice/hmpps-forge/govuk-components'
import { access, throwError, Condition, Session, step, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'

const heading = GovUKHeading({ text: 'Admin panel', size: 'l' })

const body = GovUKBody({
  text: 'This page is only accessible to users with the admin role. Viewers who try to access it receive a 403 error.',
})

const backLink = GovUKLinkButton({
  text: 'Back to dashboard',
  href: '/auth-role/dashboard',
  classes: 'govuk-button--secondary',
})

export const adminPanelStep = step({
  code: 'admin-panel',
  path: '/admin-panel',
  title: 'Admin panel',
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
    access({
      next: [
        throwError({
          when: Session('demoUser.role').not.match(Condition.Equals('admin')),
          status: 403,
          message: 'You do not have permission to access this page',
        }),
      ],
    }),
  ],
  blocks: [heading, body, backLink],
})
