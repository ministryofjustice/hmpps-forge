import { submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { fullNameField, continueButton } from './blocks'

// Each question page validates on submit, saves the answer into the session,
// and redirects to the next question. Because the journey loads answers on
// access, returning users see their previous input already filled in.
export const yourNameStep = patternStep({
  code: 'your-name',
  path: '/your-name',
  title: 'What is your name?',
  reachability: { entryWhen: true },
  blocks: [fullNameField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [PatternEffects.SaveDraftAnswers('single-question-per-page')],
        next: [redirect({ goto: 'your-role' })],
      },
    }),
  ],
  sourceBase: 'single-question-per-page/demo/your-name',
  codeFiles: ['step.ts', 'blocks.ts'],
})
