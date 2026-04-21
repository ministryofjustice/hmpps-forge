import { submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import {
  heading,
  addressLine1Field,
  addressLine2Field,
  addressTownField,
  addressPostcodeField,
  continueButton,
} from './blocks'

// All four fields on one step, one validation pass, one save. Every missing or
// invalid field's message surfaces together in the error summary.
export const addressStep = patternStep({
  code: 'address',
  path: '/address',
  title: 'What is your address?',
  blocks: [
    heading,
    addressLine1Field,
    addressLine2Field,
    addressTownField,
    addressPostcodeField,
    continueButton,
  ],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [PatternEffects.SaveDraftAnswers('composite-fields')],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
  sourceBase: 'composite-fields/demo/address',
  codeFiles: ['step.ts', 'blocks.ts'],
})
