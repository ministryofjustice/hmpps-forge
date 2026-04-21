import {submit, redirect, tieBreaker} from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { dateOfBirthField, continueButton } from './blocks'

export const dateOfBirthStep = patternStep({
  code: 'date-of-birth',
  path: '/date-of-birth',
  title: 'What is your date of birth?',
  reachability: {
    entryWhen: true,
    tieBreakers: [tieBreaker({ priority: 100 })]
  },
  blocks: [dateOfBirthField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [PatternEffects.SaveDraftAnswers('composite-fields')],
        next: [redirect({ goto: 'address' })],
      },
    }),
  ],
  sourceBase: 'composite-fields/demo/date-of-birth',
  codeFiles: ['step.ts', 'blocks.ts'],
})
