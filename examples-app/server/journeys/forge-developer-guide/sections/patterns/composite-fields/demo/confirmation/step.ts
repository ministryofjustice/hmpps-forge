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
  title: 'Details saved',
  reachability: {
    entryWhen: Session('patternSubmitted.composite-fields').match(Condition.Equals(true)),
    tieBreakers: [tieBreaker({ priority: 200 })],
  },
  blocks: [panel, nextSteps, restartButton],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [
          PatternEffects.ClearAnswers('composite-fields'),
          PatternEffects.ClearDraftAnswers('composite-fields'),
          PatternEffects.SaveSubmitStateToSession('composite-fields', false),
        ],
        next: [redirect({ goto: 'overview' })],
      },
    }),
  ],
  sourceBase: 'composite-fields/demo/confirmation',
  codeFiles: ['step.ts', 'blocks.ts'],
})
