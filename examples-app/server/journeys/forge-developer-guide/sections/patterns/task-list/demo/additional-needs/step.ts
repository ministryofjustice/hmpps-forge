import { submit, redirect, Answer, Condition, and } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heading, hint, additionalNeedsField, continueButton } from './blocks'

// Only reachable once both preceding sections are complete
const prerequisitesMet = and(
  Answer('yourDetailsStatus').match(Condition.Equals('completed')),
  Answer('visitPreferencesStatus').match(Condition.Equals('completed')),
)

export const additionalNeedsStep = patternStep({
  code: 'additional-needs',
  path: '/additional-needs',
  title: 'Additional needs',
  // Gated entry — blocks direct URL access until prerequisites are met
  reachability: { entryWhen: prerequisitesMet },
  backlink: 'tasks',
  blocks: [heading, hint, additionalNeedsField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [
          // Single-step section — goes straight to completed
          PatternEffects.SetAnswer('additionalNeedsStatus', 'completed'),
          PatternEffects.SaveDraftAnswers('task-list'),
        ],
        // Return to task list hub
        next: [redirect({ goto: 'tasks' })],
      },
    }),
  ],
  sourceBase: 'task-list/demo/additional-needs',
  codeFiles: ['step.ts', 'blocks.ts'],
})
