import { submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { fullNameField, continueButton } from './blocks'

export const yourNameStep = patternStep({
  code: 'your-name',
  path: '/your-name',
  title: 'What is your name?',
  // Entry point that the resume walk evaluates from — when the user has
  // answered this step, resume skips past it to the next unanswered step.
  reachability: { entryWhen: true },
  blocks: [fullNameField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        // Persist progress so the user can leave and resume later
        effects: [PatternEffects.SaveDraftAnswers('resuming')],
        next: [redirect({ goto: 'your-role' })],
      },
    }),
  ],
  sourceBase: 'resuming/demo/your-name',
  codeFiles: ['step.ts', 'blocks.ts'],
})
