import { Self, Condition, validation, submit, redirect, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKTextInput, GovUKSelectInput, GovUKButton, GovUKHeading, GovUKUtilityClasses } from '@ministryofjustice/hmpps-forge/govuk-components'
import { addContact, saveDraftAnswers } from './effects'

const heading = GovUKHeading({
  text: 'Add an emergency contact',
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

export const addContactStep = step({
  code: 'add-contact',
  path: '/add-contact',
  title: 'Add an emergency contact',
  // Entry point so this page stays reachable even when the list page's
  // validWhen rule fails (empty collection blocks forward propagation).
  reachability: { entryWhen: true },
  blocks: [heading, nameField, relationshipField, phoneField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [
          addContact(),
          saveDraftAnswers(),
        ],
        next: [redirect({ goto: 'your-contacts' })],
      },
    }),
  ],
})
