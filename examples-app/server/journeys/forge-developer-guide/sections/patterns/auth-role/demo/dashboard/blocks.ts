import { Format, Session, Condition } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKInsetText,
  GovUKLinkButton,
  GovUKButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({ text: 'Dashboard', size: 'l' })

export const welcomeMessage = GovUKBody({
  text: Format('Signed in as %1 (role: %2).', Session('demoUser.name'), Session('demoUser.role')),
})

export const viewerWarning = GovUKInsetText({
  text: "You are signed in as a viewer. The admin panel will return a raw 403 error page. Use your browser's back button to return here.",
  visibleWhen: Session('demoUser.role').match(Condition.Equals('viewer')),
})

export const adminLink = GovUKLinkButton({
  text: 'Go to admin panel',
  href: '/forge-developer-guide/patterns/demos/auth-role/admin-panel',
})

export const logoutButton = GovUKButton({
  text: 'Log out',
  name: 'action',
  value: 'logout',
  classes: 'govuk-button--secondary',
})
