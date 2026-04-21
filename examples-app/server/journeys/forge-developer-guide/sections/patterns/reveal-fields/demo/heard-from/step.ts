import { submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heardFromField, continueButton } from './blocks'

export const heardFromStep = patternStep({
  code: 'heard-from',
  path: '/heard-from',
  title: 'How did you hear about us?',
  reachability: { entryWhen: true },
  blocks: [heardFromField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [PatternEffects.SaveDraftAnswers('reveal-fields')],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
  sourceBase: 'reveal-fields/demo/heard-from',
  codeFiles: ['step.ts', 'blocks.ts'],
})
