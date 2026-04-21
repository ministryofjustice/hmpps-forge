import {
  submit,
  redirect,
  Condition,
  Session,
  tieBreaker,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { panel, nextSteps, restartButton } from './blocks'

export const confirmationStep = patternStep({
  code: 'confirmation',
  path: '/confirmation',
  title: 'Answers submitted',
  reachability: {
    // Session-based entry — survives ClearDraftAnswers unlike answer-based conditions
    entryWhen: Session('patternSubmitted.resuming').match(Condition.Equals(true)),
    // Priority 200 wins over overview (100), so a submitted user lands here
    // instead of being sent back to the overview page.
    tieBreakers: [tieBreaker({ priority: 200 })],
  },
  blocks: [panel, nextSteps, restartButton],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        // Reset everything so the user can start fresh
        effects: [
          PatternEffects.ClearAnswers('resuming'),
          PatternEffects.ClearDraftAnswers('resuming'),
          PatternEffects.SaveSubmitStateToSession('resuming', false),
        ],
        next: [redirect({ goto: 'overview' })],
      },
    }),
  ],
  sourceBase: 'resuming/demo/confirmation',
  codeFiles: ['step.ts', 'blocks.ts'],
})
