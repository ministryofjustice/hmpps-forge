import { Self, Condition, validation, submit, access, redirect, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKTextInput, GovUKSelectInput, GovUKButton, GovUKHeading, GovUKUtilityClasses } from '@ministryofjustice/hmpps-forge/govuk-components'
import { loadContactForEdit, updateContact, saveDraftAnswers } from './effects'

const heading = GovUKHeading({
  text: 'Change emergency contact',
  size: 'l',
})

const nameField = GovUKTextInput({
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

const relationshipField = GovUKSelectInput({
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

const phoneField = GovUKTextInput({
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

const continueButton = GovUKButton({ text: 'Save and continue' })

export const editContactStep = step({
  code: 'edit-contact',
  // :index is extracted from the URL automatically by Forge
  path: '/edit-contact/:index',
  title: 'Change emergency contact',
  reachability: { entryWhen: true },
  blocks: [heading, nameField, relationshipField, phoneField, continueButton],
  // Pre-fill the form fields from the existing item at the given index
  onAccess: [
    access({
      effects: [loadContactForEdit()],
    }),
  ],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [
          // Replaces the item at the route index rather than appending
          updateContact(),
          saveDraftAnswers(),
        ],
        next: [redirect({ goto: 'your-contacts' })],
      },
    }),
  ],
})
