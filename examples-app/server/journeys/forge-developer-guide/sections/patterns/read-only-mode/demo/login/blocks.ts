import {
  GovUKHeading,
  GovUKBody,
  GovUKButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({ text: 'Log in', size: 'l' })

export const intro = GovUKBody({
  text: 'Pick a role to simulate logging in. Admins can edit the contact record. Viewers can only view it.',
})

export const adminButton = GovUKButton({
  text: 'Log in as Admin',
  name: 'action',
  value: 'login-admin',
})

export const viewerButton = GovUKButton({
  text: 'Log in as Viewer',
  name: 'action',
  value: 'login-viewer',
  classes: 'govuk-button--secondary',
})
