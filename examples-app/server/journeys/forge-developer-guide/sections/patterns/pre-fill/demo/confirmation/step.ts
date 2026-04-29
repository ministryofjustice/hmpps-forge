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
  title: 'Address saved',
  reachability: {
    entryWhen: Session('patternSubmitted.pre-fill').match(Condition.Equals(true)),
    tieBreakers: [tieBreaker({ priority: 200 })],
  },
  blocks: [panel, nextSteps, restartButton],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [
          PatternEffects.ClearAnswers('pre-fill'),
          PatternEffects.ClearDraftAnswers('pre-fill'),
          PatternEffects.SaveSubmitStateToSession('pre-fill', false),
        ],
        next: [redirect({ goto: 'overview' })],
      },
    }),
  ],
  sourceBase: 'pre-fill/demo/confirmation',
  codeFiles: ['step.ts', 'blocks.ts'],
})
