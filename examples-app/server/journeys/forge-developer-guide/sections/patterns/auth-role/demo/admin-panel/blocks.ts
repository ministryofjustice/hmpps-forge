import {
  GovUKHeading,
  GovUKBody,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({ text: 'Admin panel', size: 'l' })

export const body = GovUKBody({
  text: 'This page is only accessible to users with the admin role. Viewers who try to access it receive a 403 error.',
})

export const backLink = GovUKLinkButton({
  text: 'Back to dashboard',
  href: '/forge-developer-guide/patterns/demos/auth-role/dashboard',
  classes: 'govuk-button--secondary',
})
