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
          PatternEffects.SaveAnswers('composite-fields'),
          PatternEffects.SaveSubmitStateToSession('composite-fields', true),
          PatternEffects.ClearDraftAnswers('composite-fields'),
        ],
        next: [
          redirect({
            when: Session('patternSubmitted.composite-fields').match(Condition.Equals(true)),
            goto: 'confirmation',
          }),
        ],
      },
    }),
  ],
  sourceBase: 'composite-fields/demo/check-answers',
  codeFiles: ['step.ts', 'blocks.ts'],
})
