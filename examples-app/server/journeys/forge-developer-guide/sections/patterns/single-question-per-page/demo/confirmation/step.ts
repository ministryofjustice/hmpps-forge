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
  title: 'Answers saved',
  reachability: {
    entryWhen: Session('patternSubmitted.single-question-per-page').match(Condition.Equals(true)),
    tieBreakers: [tieBreaker({ priority: 200 })],
  },
  blocks: [panel, nextSteps, restartButton],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [
          PatternEffects.ClearAnswers('single-question-per-page'),
          PatternEffects.ClearDraftAnswers('single-question-per-page'),
          PatternEffects.SaveSubmitStateToSession('single-question-per-page', false),
        ],
        next: [redirect({ goto: 'overview' })],
      },
    }),
  ],
  sourceBase: 'single-question-per-page/demo/confirmation',
  codeFiles: ['step.ts', 'blocks.ts'],
})
