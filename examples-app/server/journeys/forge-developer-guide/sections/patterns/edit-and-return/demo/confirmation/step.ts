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
  title: 'Details submitted',
  reachability: {
    entryWhen: Session('patternSubmitted.edit-and-return').match(Condition.Equals(true)),
    tieBreakers: [tieBreaker({ priority: 200 })],
  },
  blocks: [panel, nextSteps, restartButton],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [
          PatternEffects.ClearAnswers('edit-and-return'),
          PatternEffects.ClearDraftAnswers('edit-and-return'),
          PatternEffects.SaveSubmitStateToSession('edit-and-return', false),
        ],
        next: [redirect({ goto: 'overview' })],
      },
    }),
  ],
  sourceBase: 'edit-and-return/demo/confirmation',
  codeFiles: ['step.ts', 'blocks.ts'],
})
