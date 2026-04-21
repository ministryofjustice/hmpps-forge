import { submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../../shared/patternStep'
import { PatternEffects } from '../../../../effects'
import { heading, dayField, continueButton } from './blocks'

export const preferredDayStep = patternStep({
  code: 'preferred-day',
  path: '/preferred-day',
  title: 'Preferred day',
  // Entry point for this child journey — linked from the task list hub
  reachability: { entryWhen: true },
  // Override backlink to point to the task list hub in the parent journey
  backlink: '../tasks',
  blocks: [heading, dayField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [
          // Mark section as started
          PatternEffects.SetAnswer('visitPreferencesStatus', 'in-progress'),
          PatternEffects.SaveDraftAnswers('task-list'),
        ],
        // Next step within this child journey
        next: [redirect({ goto: 'visit-type' })],
      },
    }),
  ],
  sourceBase: 'task-list/demo/visit-preferences/preferred-day',
  codeFiles: ['step.ts', 'blocks.ts'],
})
