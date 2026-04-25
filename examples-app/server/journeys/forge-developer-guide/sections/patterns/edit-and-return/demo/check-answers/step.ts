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
          PatternEffects.SaveAnswers('edit-and-return'),
          PatternEffects.SaveSubmitStateToSession('edit-and-return', true),
          PatternEffects.ClearDraftAnswers('edit-and-return'),
        ],
        next: [
          redirect({
            when: Session('patternSubmitted.edit-and-return').match(Condition.Equals(true)),
            goto: 'confirmation',
          }),
        ],
      },
    }),
  ],
  sourceBase: 'edit-and-return/demo/check-answers',
  codeFiles: ['step.ts', 'blocks.ts'],
})
