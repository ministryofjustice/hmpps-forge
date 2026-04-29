import { Answer, Format, Session } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKSummaryList,
  GovUKButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({ text: 'Contacts', size: 'l' })

export const roleMessage = GovUKBody({
  text: Format('Signed in as %1 (%2).', Session('demoUser.name'), Session('demoUser.role')),
})

export const contactsList = GovUKSummaryList({
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

export const logoutButton = GovUKButton({
  text: 'Log out',
  name: 'action',
  value: 'logout',
  classes: 'govuk-button--secondary',
})
