import { submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heading, nameField, relationshipField, phoneField, continueButton } from './blocks'

// The fields bundled into each collection item
const CONTACT_FIELD_CODES = ['contactName', 'contactRelationship', 'contactPhone']

export const addContactStep = patternStep({
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
          // Bundles the temporary field answers into an object and appends
          // it to the contacts array, then clears the fields for next time.
          PatternEffects.AddItemToCollection('contacts', CONTACT_FIELD_CODES),
          PatternEffects.SaveDraftAnswers('add-another'),
        ],
        next: [redirect({ goto: 'your-contacts' })],
      },
    }),
  ],
  sourceBase: 'add-another/demo/add-contact',
  codeFiles: ['step.ts', 'blocks.ts'],
})
