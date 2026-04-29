import { submit, redirect, Condition, Session } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heading, summaryList, confirmBody, submitButton } from './blocks'

export const checkAnswersStep = patternStep({
  code: 'check-answers',
  path: '/check-answers',
  title: 'Check your answers',
  blocks: [heading, summaryList, confirmBody, submitButton],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [
          PatternEffects.SaveAnswers('pre-fill'),
          PatternEffects.SaveSubmitStateToSession('pre-fill', true),
          PatternEffects.ClearDraftAnswers('pre-fill'),
        ],
        next: [
          redirect({
            when: Session('patternSubmitted.pre-fill').match(Condition.Equals(true)),
            goto: 'confirmation',
          }),
        ],
      },
    }),
  ],
  sourceBase: 'pre-fill/demo/check-answers',
  codeFiles: ['step.ts', 'blocks.ts'],
})
