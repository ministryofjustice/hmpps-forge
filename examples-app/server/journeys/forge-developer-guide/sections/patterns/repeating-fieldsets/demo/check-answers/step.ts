import {
  submit,
  redirect,
  access,
  Condition,
  Session,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heading, memberSummaries, changeLink, confirmBody, submitButton } from './blocks'

const patternCode = 'repeating-fieldsets'
const collectionCode = 'members'
const fieldCodes = ['memberName', 'memberAge']

export const checkAnswersStep = patternStep({
  code: 'check-answers',
  path: '/check-answers',
  title: 'Check your answers',
  blocks: [heading, memberSummaries, changeLink, confirmBody, submitButton],
  onAccess: [
    access({
      effects: [
        PatternEffects.InitializeRepeatingFieldsets(patternCode, collectionCode, fieldCodes),
      ],
    }),
  ],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [
          PatternEffects.SaveAnswers(patternCode),
          PatternEffects.SaveSubmitStateToSession(patternCode, true),
        ],
        next: [
          redirect({
            when: Session(`patternSubmitted.${patternCode}`).match(Condition.Equals(true)),
            goto: 'confirmation',
          }),
        ],
      },
    }),
  ],
  sourceBase: 'repeating-fieldsets/demo/check-answers',
  codeFiles: ['step.ts', 'blocks.ts'],
})
