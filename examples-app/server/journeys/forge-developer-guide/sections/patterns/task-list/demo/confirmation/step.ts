import {submit, redirect, Post, Condition, Session, tieBreaker} from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { panel, whatNext, restartButton } from './blocks'

export const confirmationStep = patternStep({
  code: 'confirmation',
  path: '/confirmation',
  title: 'Application submitted',
  reachability: {
    // Session-based entry — survives ClearDraftAnswers unlike answer-based conditions
    entryWhen: Session('patternSubmitted.task-list').match(Condition.Equals(true)),
    // Win over the tasks entrypoint, so that if user opens journey again (but hasnt reset),
    // they are taken straight to the confirmation page.
    tieBreakers: [ tieBreaker({ priority: 100 }) ]
  },
  blocks: [panel, whatNext, restartButton],
  onSubmission: [
    submit({
      when: Post('action').match(Condition.Equals('restart')),
      validate: false,
      onAlways: {
        effects: [
          // Reset everything so the user can start fresh
          PatternEffects.ClearAnswers('task-list'),
          PatternEffects.ClearDraftAnswers('task-list'),
          PatternEffects.SaveSubmitStateToSession('task-list', false),
        ],
        next: [redirect({ goto: 'overview' })],
      },
    }),
  ],
  sourceBase: 'task-list/demo/confirmation',
  codeFiles: ['step.ts', 'blocks.ts'],
})
