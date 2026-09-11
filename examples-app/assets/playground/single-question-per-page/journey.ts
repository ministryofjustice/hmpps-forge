import { journey, access, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadDraftAnswers, loadSavedAnswers } from './effects'
import type { PatternDependencies } from './effects'
import { AnswerStore } from './AnswerStore'
import { overviewStep } from './overview'
import { yourNameStep } from './your-name'
import { yourRoleStep } from './your-role'
import { checkAnswersStep } from './check-answers'
import { confirmationStep } from './confirmation'

// The demo journey loads any draft answers stored in the session on every access so
// the user can jump between steps without losing their progress.
export const singleQuestionPerPageDemoJourney = journey({
  code: 'single-question-per-page-demo',
  title: 'Single question per page',
  path: '/single-question-per-page',
  onAccess: [
    access({
      effects: [loadDraftAnswers(), loadSavedAnswers()],
    }),
  ],
  steps: [overviewStep, yourNameStep, yourRoleStep, checkAnswersStep, confirmationStep],
})

export const dependencies: PatternDependencies = { answerStore: new AnswerStore() }

export default createForgePackage<PatternDependencies>({ journey: singleQuestionPerPageDemoJourney })
