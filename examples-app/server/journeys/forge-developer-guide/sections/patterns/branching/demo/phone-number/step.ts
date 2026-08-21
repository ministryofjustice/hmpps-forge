import { submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { phoneNumberField, continueButton } from './blocks'

// Branch step for the phone path — only reachable when visitType is 'phone'.
// All branches converge on check-answers after collecting their details.
export const phoneNumberStep = patternStep({
  code: 'phone-number',
  path: '/phone-number',
  title: 'What number should we call you on?',
  blocks: [phoneNumberField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [PatternEffects.SaveDraftAnswers('branching')],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
  sourceBase: 'branching/demo/phone-number',
  codeFiles: ['step.ts', 'blocks.ts', 'conditions.ts'],
})
