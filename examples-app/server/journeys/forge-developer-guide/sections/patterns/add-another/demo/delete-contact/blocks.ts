import { Data, match, Condition } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKSummaryList,
  GovUKButton,
  GovUKButtonGroup,
} from '@ministryofjustice/hmpps-forge/govuk-components'

const relationshipLabel = (relationship: Parameters<typeof match>[0]) =>
  match(relationship)
    .branch(Condition.Equals('partner'), 'Partner')
    .branch(Condition.Equals('parent'), 'Parent')
    .branch(Condition.Equals('sibling'), 'Sibling')
    .branch(Condition.Equals('child'), 'Child')
    .branch(Condition.Equals('friend'), 'Friend')
    .branch(Condition.Equals('colleague'), 'Colleague')
    .branch(Condition.Equals('other'), 'Other')
    .otherwise('')

export const heading = GovUKHeading({
  text: 'Are you sure you want to remove this contact?',
  size: 'l',
})

export const contactSummary = GovUKSummaryList({
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

export const buttons = GovUKButtonGroup({
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
