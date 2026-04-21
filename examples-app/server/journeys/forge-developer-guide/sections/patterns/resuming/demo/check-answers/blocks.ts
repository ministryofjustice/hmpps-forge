import { Answer } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKSummaryList,
  GovUKButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Check your answers',
})

export const summaryList = GovUKSummaryList({
  rows: [
    {
      key: { text: 'Name' },
      value: { text: Answer('fullName') },
      actions: { items: [{ href: 'your-name', text: 'Change', visuallyHiddenText: 'name' }] },
    },
    {
      key: { text: 'Role' },
      value: { text: Answer('role') },
      actions: { items: [{ href: 'your-role', text: 'Change', visuallyHiddenText: 'role' }] },
    },
  ],
})

export const confirmBody = GovUKBody({
  text: 'Selecting "Confirm" will save your answers.',
})

export const submitButton = GovUKButton({ text: 'Confirm', name: 'action', value: 'confirm' })
