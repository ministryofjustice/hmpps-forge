import { Self, Condition, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKSelectInput,
  GovUKButton,
  GovUKHeading,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'What is your relationship to the prisoner?',
  size: 'l',
})

export const relationshipField = GovUKSelectInput({
  code: 'relationship',
  label: {
    text: 'Relationship',
    classes: GovUKUtilityClasses.Label.Medium,
  },
  items: [
    { value: '', text: 'Choose a relationship' },
    { value: 'partner', text: 'Partner or spouse' },
    { value: 'parent', text: 'Parent' },
    { value: 'child', text: 'Son or daughter' },
    { value: 'sibling', text: 'Brother or sister' },
    { value: 'friend', text: 'Friend' },
    { value: 'legal', text: 'Legal representative' },
    { value: 'other', text: 'Other' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select your relationship to the prisoner',
      submissionOnly: true,
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Save and return' })
