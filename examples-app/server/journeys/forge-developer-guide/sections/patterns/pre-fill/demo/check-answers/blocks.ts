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
      key: { text: 'Address line 1' },
      value: { text: Answer('addressLine1') },
      actions: {
        items: [{ href: 'find-address', text: 'Change', visuallyHiddenText: 'address line 1' }],
      },
    },
    {
      key: { text: 'Address line 2' },
      value: { text: Answer('addressLine2') },
      actions: {
        items: [{ href: 'find-address', text: 'Change', visuallyHiddenText: 'address line 2' }],
      },
    },
    {
      key: { text: 'Town or city' },
      value: { text: Answer('addressTown') },
      actions: {
        items: [{ href: 'find-address', text: 'Change', visuallyHiddenText: 'town or city' }],
      },
    },
    {
      key: { text: 'County' },
      value: { text: Answer('addressCounty') },
      actions: { items: [{ href: 'find-address', text: 'Change', visuallyHiddenText: 'county' }] },
    },
    {
      key: { text: 'Postcode' },
      value: { text: Answer('addressPostcode') },
      actions: {
        items: [{ href: 'find-address', text: 'Change', visuallyHiddenText: 'postcode' }],
      },
    },
  ],
})

export const confirmBody = GovUKBody({
  text: 'Selecting "Confirm" will save your answers.',
})

export const submitButton = GovUKButton({ text: 'Confirm' })
