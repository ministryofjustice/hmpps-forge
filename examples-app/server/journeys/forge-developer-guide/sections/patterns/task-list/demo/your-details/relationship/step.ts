import { submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../../shared/patternStep'
import { PatternEffects } from '../../../../effects'
import { heading, relationshipField, continueButton } from './blocks'

export const relationshipStep = patternStep({
  code: 'relationship',
  path: '/relationship',
  title: 'Relationship',
  blocks: [heading, relationshipField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [
          // Mark section as complete
          PatternEffects.SetAnswer('yourDetailsStatus', 'completed'),
          PatternEffects.SaveDraftAnswers('task-list'),
        ],
        // Return to task list hub in the parent journey
        next: [redirect({ goto: '../tasks' })],
      },
    }),
  ],
  sourceBase: 'task-list/demo/your-details/relationship',
  codeFiles: ['step.ts', 'blocks.ts'],
})
