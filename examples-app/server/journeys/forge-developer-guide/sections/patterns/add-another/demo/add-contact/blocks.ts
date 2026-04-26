import { Self, Condition, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKTextInput,
  GovUKSelectInput,
  GovUKButton,
  GovUKHeading,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Add an emergency contact',
  size: 'l',
})

export const nameField = GovUKTextInput({
  code: 'contactName',
  label: {
    text: 'Full name',
    classes: GovUKUtilityClasses.Label.Medium,
  },
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a full name',
      submissionOnly: true,
    }),
  ],
})

export const relationshipField = GovUKSelectInput({
  code: 'contactRelationship',
  label: {
    text: 'Relationship',
    classes: GovUKUtilityClasses.Label.Medium,
  },
  items: [
    { value: '', text: 'Choose a relationship' },
    { value: 'partner', text: 'Partner' },
    { value: 'parent', text: 'Parent' },
    { value: 'sibling', text: 'Sibling' },
    { value: 'child', text: 'Child' },
    { value: 'friend', text: 'Friend' },
    { value: 'colleague', text: 'Colleague' },
    { value: 'other', text: 'Other' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select a relationship',
      submissionOnly: true,
    }),
  ],
})

export const phoneField = GovUKTextInput({
  code: 'contactPhone',
  label: {
    text: 'Phone number',
    classes: GovUKUtilityClasses.Label.Medium,
  },
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a phone number',
      submissionOnly: true,
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Save and continue' })
