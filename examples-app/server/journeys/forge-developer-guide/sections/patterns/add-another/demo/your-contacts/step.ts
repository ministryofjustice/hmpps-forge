import {
  submit,
  access,
  redirect,
  validation,
  Answer,
  Post,
  Query,
  Condition,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heading, contactCards, buttonGroup } from './blocks'

export const yourContactsStep = patternStep({
  code: 'your-contacts',
  path: '/your-contacts',
  title: 'Your emergency contacts',
  reachability: { entryWhen: true },
  blocks: [heading, contactCards, buttonGroup],
  // Step-level validation — requires at least one contact before the user
  // can continue. Also feeds into reachability: downstream steps are
  // unreachable while this rule fails.
  validWhen: [
    validation({
      condition: Answer('contacts').match(Condition.IsRequired()),
      message: 'Add at least one emergency contact',
    }),
  ],
  // Handles removal via ?remove= query parameter. The redirect strips the
  // param so a page refresh does not re-trigger the removal.
  onAccess: [
    access({
      when: Query('remove').match(Condition.IsRequired()),
      effects: [
        PatternEffects.RemoveItemFromCollection('contacts'),
        PatternEffects.SaveDraftAnswers('add-another'),
      ],
      next: [redirect({ goto: 'your-contacts' })],
    }),
  ],
  onSubmission: [
    // "Add another" skips validation so the user is never blocked from
    // adding their first contact when the collection is empty.
    submit({
      when: Post('action').match(Condition.Equals('add-another')),
      validate: false,
      onAlways: {
        effects: [PatternEffects.SaveDraftAnswers('add-another')],
        next: [redirect({ goto: 'add-contact' })],
      },
    }),
    // "Continue" validates — triggers the step-level validWhen rule above.
    submit({
      when: Post('action').match(Condition.Equals('continue')),
      validate: true,
      onValid: {
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
  sourceBase: 'add-another/demo/your-contacts',
  codeFiles: ['step.ts', 'blocks.ts'],
})
