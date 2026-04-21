import { submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../../shared/patternStep'
import { PatternEffects } from '../../../../effects'
import { heading, nameField, continueButton } from './blocks'

export const yourNameStep = patternStep({
  code: 'your-name',
  path: '/your-name',
  title: 'Your name',
  // Entry point for this child journey — linked from the task list hub
  reachability: { entryWhen: true },
  // Override backlink to point to the task list hub in the parent journey
  backlink: '../tasks',
  blocks: [heading, nameField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [
          // Mark section as started
          PatternEffects.SetAnswer('yourDetailsStatus', 'in-progress'),
          PatternEffects.SaveDraftAnswers('task-list'),
        ],
        // Next step within this child journey
        next: [redirect({ goto: 'relationship' })],
      },
    }),
  ],
  sourceBase: 'task-list/demo/your-details/your-name',
  codeFiles: ['step.ts', 'blocks.ts'],
})
