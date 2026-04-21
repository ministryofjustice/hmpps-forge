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
          // Persist answers permanently, mark submitted in session, then clear drafts
          PatternEffects.SaveAnswers('branching'),
          PatternEffects.SaveSubmitStateToSession('branching', true),
          PatternEffects.ClearDraftAnswers('branching'),
        ],
        next: [
          redirect({
            // Gate on session state so the redirect only fires after the effects
            // above have run — the session value survives ClearDraftAnswers.
            when: Session('patternSubmitted.branching').match(Condition.Equals(true)),
            goto: 'confirmation',
          }),
        ],
      },
    }),
  ],
  sourceBase: 'branching/demo/check-answers',
  codeFiles: ['step.ts', 'blocks.ts'],
})
