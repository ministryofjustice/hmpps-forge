import { submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../../shared/patternStep'
import { PatternEffects } from '../../../../effects'
import { heading, visitTypeField, continueButton } from './blocks'

export const visitTypeStep = patternStep({
  code: 'visit-type',
  path: '/visit-type',
  title: 'Visit type',
  blocks: [heading, visitTypeField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [
          // Mark section as complete
          PatternEffects.SetAnswer('visitPreferencesStatus', 'completed'),
          PatternEffects.SaveDraftAnswers('task-list'),
        ],
        // Return to task list hub in the parent journey
        next: [redirect({ goto: '../tasks' })],
      },
    }),
  ],
  sourceBase: 'task-list/demo/visit-preferences/visit-type',
  codeFiles: ['step.ts', 'blocks.ts'],
})
