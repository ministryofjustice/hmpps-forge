import {
  submit,
  redirect,
  Condition,
  Session,
  Answer,
  and,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import {
  heading,
  yourDetailsSummary,
  visitPreferencesSummary,
  additionalNeedsSummary,
  confirmBody,
  submitButton,
} from './blocks'

// Only reachable once every section is complete
const allComplete = and(
  Answer('yourDetailsStatus').match(Condition.Equals('completed')),
  Answer('visitPreferencesStatus').match(Condition.Equals('completed')),
  Answer('additionalNeedsStatus').match(Condition.Equals('completed')),
)

export const checkAnswersStep = patternStep({
  code: 'check-answers',
  path: '/check-answers',
  title: 'Check your answers',
  // Gated entry — all sections must be done before the user can review
  reachability: { entryWhen: allComplete },
  backlink: 'tasks',
  blocks: [
    heading,
    yourDetailsSummary,
    visitPreferencesSummary,
    additionalNeedsSummary,
    confirmBody,
    submitButton,
  ],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [
          // Persist answers permanently, mark submitted in session, then clear drafts
          PatternEffects.SaveAnswers('task-list'),
          PatternEffects.SaveSubmitStateToSession('task-list', true),
          PatternEffects.ClearDraftAnswers('task-list'),
        ],
        next: [
          redirect({
            when: Session('patternSubmitted.task-list').match(Condition.Equals(true)),
            goto: 'confirmation',
          }),
        ],
      },
    }),
  ],
  sourceBase: 'task-list/demo/check-answers',
  codeFiles: ['step.ts', 'blocks.ts'],
})
