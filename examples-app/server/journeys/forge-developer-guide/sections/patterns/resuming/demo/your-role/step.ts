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
        effects: [PatternEffects.SaveDraftAnswers('resuming')],
        // Last question — proceed to the summary page
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
  sourceBase: 'resuming/demo/your-role',
  codeFiles: ['step.ts', 'blocks.ts'],
})
