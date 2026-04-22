import {
  submit,
  action,
  access,
  redirect,
  Post,
  Condition, validation, Answer, Data,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heading, memberRows, buttonGroup } from './blocks'

const patternCode = 'repeating-fieldsets'
const collectionCode = 'members'
const fieldCodes = ['memberName', 'memberAge']

export const householdMembersStep = patternStep({
  code: 'household-members',
  path: '/household-members',
  title: 'Household members',
  reachability: { entryWhen: true },
  blocks: [heading, memberRows, buttonGroup],
  onAccess: [
    access({
      effects: [
        PatternEffects.InitializeRepeatingFieldsets(patternCode, collectionCode, fieldCodes),
      ],
    }),
  ],
  onAction: [
    action({
      when: Post('action').match(Condition.Equals('add-another')),
      effects: [PatternEffects.AddRepeatingItem(patternCode, collectionCode, fieldCodes)],
    }),
    action({
      when: Post('action').match(Condition.String.StartsWith('remove_')),
      effects: [PatternEffects.RemoveRepeatingItem(patternCode, collectionCode, fieldCodes)],
    }),
  ],
  onSubmission: [
    submit({
      when: Post('action').match(Condition.Equals('continue')),
      validate: true,
      onValid: {
        effects: [PatternEffects.SaveRepeatingItems(patternCode, collectionCode, fieldCodes)],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
  // Step-level validation — requires at least one contact before the user
  // can continue. Also feeds into reachability: downstream steps are
  // unreachable while this rule fails.
  validWhen: [
    validation({
      condition: Data('members').match(Condition.IsRequired()),
      message: 'Add at least one household member',
    }),
  ],
  sourceBase: 'repeating-fieldsets/demo/household-members',
  codeFiles: [
    'step.ts',
    'blocks.ts',
    {
      path: '/effects.ts',
      lines: [
        [66, 93],
        [320, 476],
      ],
    },
  ],
})
