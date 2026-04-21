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
  title: 'Emergency contacts saved',
  reachability: {
    // Session-based entry — survives ClearDraftAnswers unlike answer-based conditions
    entryWhen: Session('patternSubmitted.add-another').match(Condition.Equals(true)),
    // Priority 200 wins over the overview entry point
    tieBreakers: [tieBreaker({ priority: 200 })],
  },
  blocks: [panel, nextSteps, restartButton],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        // Reset everything so the user can start fresh
        effects: [
          PatternEffects.ClearAnswers('add-another'),
          PatternEffects.ClearDraftAnswers('add-another'),
          PatternEffects.SaveSubmitStateToSession('add-another', false),
        ],
        next: [redirect({ goto: 'overview' })],
      },
    }),
  ],
  sourceBase: 'add-another/demo/confirmation',
  codeFiles: ['step.ts', 'blocks.ts'],
})
