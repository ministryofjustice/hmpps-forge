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

const patternCode = 'repeating-fieldsets'

export const confirmationStep = patternStep({
  code: 'confirmation',
  path: '/confirmation',
  title: 'Household saved',
  reachability: {
    entryWhen: Session(`patternSubmitted.${patternCode}`).match(Condition.Equals(true)),
    tieBreakers: [tieBreaker({ priority: 200 })],
  },
  blocks: [panel, nextSteps, restartButton],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [
          PatternEffects.ClearAnswers(patternCode),
          PatternEffects.ClearDraftAnswers(patternCode),
          PatternEffects.SaveSubmitStateToSession(patternCode, false),
        ],
        next: [redirect({ goto: 'overview' })],
      },
    }),
  ],
  sourceBase: 'repeating-fieldsets/demo/confirmation',
  codeFiles: ['step.ts', 'blocks.ts'],
})
