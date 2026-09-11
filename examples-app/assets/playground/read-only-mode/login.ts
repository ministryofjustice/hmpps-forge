import { submit, redirect, Condition, Post, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { simulateLogin } from './effects'
import {
  GovUKHeading,
  GovUKBody,
  GovUKButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

const heading = GovUKHeading({ text: 'Log in', size: 'l' })

const intro = GovUKBody({
  text: 'Pick a role to simulate logging in. Admins can edit the contact record. Viewers can only view it.',
})

const adminButton = GovUKButton({
  text: 'Log in as Admin',
  name: 'action',
  value: 'login-admin',
})

const viewerButton = GovUKButton({
  text: 'Log in as Viewer',
  name: 'action',
  value: 'login-viewer',
  classes: 'govuk-button--secondary',
})

export const loginStep = step({
  code: 'login',
  path: '/login',
  title: 'Log in',
  reachability: { entryWhen: true },
  blocks: [heading, intro, adminButton, viewerButton],
  onSubmission: [
    submit({
      when: Post('action').match(Condition.Equals('login-admin')),
      validate: false,
      onAlways: {
        effects: [simulateLogin('Demo Admin', 'admin')],
        next: [redirect({ goto: 'contacts' })],
      },
    }),
    submit({
      when: Post('action').match(Condition.Equals('login-viewer')),
      validate: false,
      onAlways: {
        effects: [simulateLogin('Demo Viewer', 'viewer')],
        next: [redirect({ goto: 'contacts' })],
      },
    }),
  ],
})
