import {
  submit,
  access,
  redirect,
  Post,
  Condition,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heading, contactSummary, buttons } from './blocks'

const CONTACT_FIELD_CODES = ['contactName', 'contactRelationship', 'contactPhone']

export const deleteContactStep = patternStep({
  code: 'delete-contact',
  path: '/delete-contact/:index',
  title: 'Remove emergency contact',
  reachability: { entryWhen: true },
  blocks: [heading, contactSummary, buttons],
  onAccess: [
    access({
      effects: [PatternEffects.LoadItemForDelete('contacts', CONTACT_FIELD_CODES)],
    }),
  ],
  onSubmission: [
    submit({
      when: Post('action').match(Condition.Equals('confirm')),
      validate: false,
      onAlways: {
        effects: [
          PatternEffects.DeleteItemFromCollection('contacts'),
          PatternEffects.SaveDraftAnswers('add-another'),
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
  sourceBase: 'add-another/demo/delete-contact',
  codeFiles: ['step.ts', 'blocks.ts'],
})
