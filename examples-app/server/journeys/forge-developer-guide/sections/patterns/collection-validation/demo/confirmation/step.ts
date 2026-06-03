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
  title: 'Plan agreed',
  reachability: {
    entryWhen: Session('patternSubmitted.collection-validation').match(Condition.Equals(true)),
    tieBreakers: [tieBreaker({ priority: 200 })],
  },
  blocks: [panel, nextSteps, restartButton],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [
          PatternEffects.ClearDraftAnswers('collection-validation'),
          PatternEffects.SaveSubmitStateToSession('collection-validation', false),
        ],
        next: [redirect({ goto: 'overview' })],
      },
    }),
  ],
  sourceBase: 'collection-validation/demo/confirmation',
  codeFiles: ['step.ts', 'blocks.ts'],
})
