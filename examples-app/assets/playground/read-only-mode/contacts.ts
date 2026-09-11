import { access, submit, redirect, Condition, Post, step, Answer, Format, Session } from '@ministryofjustice/hmpps-forge/core/authoring'
import { simulateLogout, loadContacts } from './effects'
import {
  GovUKHeading,
  GovUKBody,
  GovUKSummaryList,
  GovUKButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

const heading = GovUKHeading({ text: 'Contacts', size: 'l' })

const roleMessage = GovUKBody({
  text: Format('Signed in as %1 (%2).', Session('demoUser.name'), Session('demoUser.role')),
})

const contactsList = GovUKSummaryList({
  rows: [
    {
      key: { text: Answer('contacts.0.recordName') },
      value: { text: Answer('contacts.0.recordEmail') },
      actions: { items: [{ href: 'record/0', text: 'View' }] },
    },
    {
      key: { text: Answer('contacts.1.recordName') },
      value: { text: Answer('contacts.1.recordEmail') },
      actions: { items: [{ href: 'record/1', text: 'View' }] },
    },
    {
      key: { text: Answer('contacts.2.recordName') },
      value: { text: Answer('contacts.2.recordEmail') },
      actions: { items: [{ href: 'record/2', text: 'View' }] },
    },
  ],
})

const logoutButton = GovUKButton({
  text: 'Log out',
  name: 'action',
  value: 'logout',
  classes: 'govuk-button--secondary',
})

export const contactsStep = step({
  code: 'contacts',
  path: '/contacts',
  title: 'Contacts',
  reachability: { entryWhen: true },
  onAccess: [
    access({
      next: [redirect({ when: Session('demoUser').not.match(Condition.IsRequired()), goto: 'login' })],
    }),
    access({ effects: [loadContacts()] }),
  ],
  blocks: [heading, roleMessage, contactsList, logoutButton],
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
