import { Data, match, Condition, submit, access, redirect, Post, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKHeading, GovUKSummaryList, GovUKButton, GovUKButtonGroup } from '@ministryofjustice/hmpps-forge/govuk-components'
import { loadContactForDelete, deleteContact, saveDraftAnswers } from './effects'

const relationshipLabel = (relationship: Parameters<typeof match>[0]) =>
  match(relationship)
    .case('partner', 'Partner')
    .case('parent', 'Parent')
    .case('sibling', 'Sibling')
    .case('child', 'Child')
    .case('friend', 'Friend')
    .case('colleague', 'Colleague')
    .case('other', 'Other')
    .otherwise('')

const heading = GovUKHeading({
  text: 'Are you sure you want to remove this contact?',
  size: 'l',
})

const contactSummary = GovUKSummaryList({
  rows: [
    {
      key: { text: 'Name' },
      value: { text: Data('contactName') },
    },
    {
      key: { text: 'Relationship' },
      value: { text: relationshipLabel(Data('contactRelationship')) },
    },
    {
      key: { text: 'Phone number' },
      value: { text: Data('contactPhone') },
    },
  ],
})

const buttons = GovUKButtonGroup({
  buttons: [
    GovUKButton({
      text: 'Remove contact',
      classes: 'govuk-button--warning',
      name: 'action',
      value: 'confirm',
    }),
    GovUKButton({
      text: 'Cancel',
      classes: 'govuk-button--secondary',
      name: 'action',
      value: 'cancel',
    }),
  ],
})

export const deleteContactStep = step({
  code: 'delete-contact',
  path: '/delete-contact/:index',
  title: 'Remove emergency contact',
  reachability: { entryWhen: true },
  blocks: [heading, contactSummary, buttons],
  onAccess: [
    access({
      effects: [loadContactForDelete()],
    }),
  ],
  onSubmission: [
    submit({
      when: Post('action').match(Condition.Equals('confirm')),
      validate: false,
      onAlways: {
        effects: [
          deleteContact(),
          saveDraftAnswers(),
        ],
        next: [redirect({ goto: 'your-contacts' })],
      },
    }),
    submit({
      when: Post('action').match(Condition.Equals('cancel')),
      validate: false,
      onAlways: {
        next: [redirect({ goto: 'your-contacts' })],
      },
    }),
  ],
})
