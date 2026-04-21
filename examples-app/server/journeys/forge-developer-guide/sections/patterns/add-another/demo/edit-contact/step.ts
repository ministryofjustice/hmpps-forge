import { submit, access, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heading, nameField, relationshipField, phoneField, continueButton } from './blocks'

const CONTACT_FIELD_CODES = ['contactName', 'contactRelationship', 'contactPhone']

export const editContactStep = patternStep({
  code: 'edit-contact',
  // :index is extracted from the URL automatically by Forge
  path: '/edit-contact/:index',
  title: 'Change emergency contact',
  reachability: { entryWhen: true },
  blocks: [heading, nameField, relationshipField, phoneField, continueButton],
  // Pre-fill the form fields from the existing item at the given index
  onAccess: [
    access({
      effects: [PatternEffects.LoadItemForEdit('add-another', 'contacts', CONTACT_FIELD_CODES)],
    }),
  ],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [
          // Replaces the item at the stored index rather than appending
          PatternEffects.EditItemInCollection('add-another', 'contacts', CONTACT_FIELD_CODES),
          PatternEffects.SaveDraftAnswers('add-another'),
        ],
        next: [redirect({ goto: 'your-contacts' })],
      },
    }),
  ],
  sourceBase: 'add-another/demo/edit-contact',
  codeFiles: ['step.ts', 'blocks.ts'],
})
