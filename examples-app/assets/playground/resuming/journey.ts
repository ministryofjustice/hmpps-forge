import { journey, access, createForgePackage, Condition, Query } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadDraftAnswers, loadSavedAnswers } from './effects'
import type { PatternDependencies } from './effects'
import { AnswerStore } from './AnswerStore'
import { overviewStep } from './overview'
import { yourNameStep } from './your-name'
import { yourRoleStep } from './your-role'
import { checkAnswersStep } from './check-answers'
import { confirmationStep } from './confirmation'

export const resumingDemoJourney = journey({
  code: 'resuming-demo',
  title: 'Resuming a partially-completed journey',
  path: '/resuming',
  reachability: {
    // When any request to this journey (including the root URL) includes
    // ?resume=true, Forge finds the furthest reachable step the user hasn't
    // completed yet and redirects there.
    resumeWhen: Query('resume').match(Condition.Equals('true')),
  },
  // Load any saved draft answers before rendering so fields are pre-filled
  // and reachability conditions can evaluate against prior progress.
  onAccess: [
    access({
      effects: [loadDraftAnswers(), loadSavedAnswers()],
    }),
  ],
  steps: [overviewStep, yourNameStep, yourRoleStep, checkAnswersStep, confirmationStep],
})

export const dependencies: PatternDependencies = { answerStore: new AnswerStore() }

export default createForgePackage<PatternDependencies>({ journey: resumingDemoJourney })
