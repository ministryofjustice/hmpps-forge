import {
  submit,
  redirect,
  Condition,
  Post,
  Session,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heading, summaryList, confirmBody, submitButton } from './blocks'

// The redirect is gated on the Confirm button being posted. On a GET — which is
// what the journey-root resume walk performs — there is no POST body, so the
// condition fails and the forward edge does not resolve. That keeps the walk
// from stepping past `check-answers` into `confirmation` for a user who has
// filled in every answer but not yet submitted.
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
          PatternEffects.SaveAnswers('resuming'),
          PatternEffects.SaveSubmitStateToSession('resuming', true),
          PatternEffects.ClearDraftAnswers('resuming'),
        ],
        next: [
          redirect({
            when: Session('patternSubmitted.resuming').match(Condition.Equals(true)),
            goto: 'confirmation',
          }),
        ],
      },
    }),
  ],
  sourceBase: 'resuming/demo/check-answers',
  codeFiles: ['step.ts', 'blocks.ts'],
})
