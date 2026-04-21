import { submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { roleField, continueButton } from './blocks'

export const yourRoleStep = patternStep({
  code: 'your-role',
  path: '/your-role',
  title: 'What is your role?',
  blocks: [roleField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [PatternEffects.SaveDraftAnswers('single-question-per-page')],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
  sourceBase: 'single-question-per-page/demo/your-role',
  codeFiles: ['step.ts', 'blocks.ts'],
})
