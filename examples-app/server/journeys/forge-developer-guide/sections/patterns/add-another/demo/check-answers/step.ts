import { submit, redirect, Condition, Session } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heading, contactSummaryCards, confirmBody, submitButton } from './blocks'

export const checkAnswersStep = patternStep({
  code: 'check-answers',
  path: '/check-answers',
  title: 'Check your answers',
  blocks: [heading, contactSummaryCards, confirmBody, submitButton],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        // Persist answers permanently, mark submitted in session, then clear drafts
        effects: [
          PatternEffects.SaveAnswers('add-another'),
          PatternEffects.SaveSubmitStateToSession('add-another', true),
          PatternEffects.ClearDraftAnswers('add-another'),
        ],
        next: [
          redirect({
            when: Session('patternSubmitted.add-another').match(Condition.Equals(true)),
            goto: 'confirmation',
          }),
        ],
      },
    }),
  ],
  sourceBase: 'add-another/demo/check-answers',
  codeFiles: ['step.ts', 'blocks.ts'],
})
