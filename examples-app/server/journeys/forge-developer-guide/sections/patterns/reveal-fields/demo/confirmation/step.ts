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
  title: 'Thanks for letting us know',
  reachability: {
    entryWhen: Session('patternSubmitted.reveal-fields').match(Condition.Equals(true)),
    tieBreakers: [tieBreaker({ priority: 200 })],
  },
  blocks: [panel, nextSteps, restartButton],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [
          PatternEffects.ClearAnswers('reveal-fields'),
          PatternEffects.ClearDraftAnswers('reveal-fields'),
          PatternEffects.SaveSubmitStateToSession('reveal-fields', false),
        ],
        next: [redirect({ goto: 'overview' })],
      },
    }),
  ],
  sourceBase: 'reveal-fields/demo/confirmation',
  codeFiles: ['step.ts', 'blocks.ts'],
})
