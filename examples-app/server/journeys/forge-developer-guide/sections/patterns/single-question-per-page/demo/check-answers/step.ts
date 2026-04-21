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
          PatternEffects.SaveAnswers('single-question-per-page'),
          PatternEffects.SaveSubmitStateToSession('single-question-per-page', true),
          PatternEffects.ClearDraftAnswers('single-question-per-page'),
        ],
        next: [
          redirect({
            when: Session('patternSubmitted.single-question-per-page').match(
              Condition.Equals(true),
            ),
            goto: 'confirmation',
          }),
        ],
      },
    }),
  ],
  sourceBase: 'single-question-per-page/demo/check-answers',
  codeFiles: ['step.ts', 'blocks.ts'],
})
