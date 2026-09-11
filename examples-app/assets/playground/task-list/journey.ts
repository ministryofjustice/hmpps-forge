import { journey, access, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadDraftAnswers, loadSavedAnswers } from './effects'
import type { PatternDependencies } from './effects'
import { AnswerStore } from './AnswerStore'
import { overviewStep } from './overview'
import { tasksStep } from './tasks'
import { yourDetailsJourney } from './your-details'
import { visitPreferencesJourney } from './visit-preferences'
import { additionalNeedsStep } from './additional-needs'
import { checkAnswersStep } from './check-answers'
import { confirmationStep } from './confirmation'

export const taskListDemoJourney = journey({
  code: 'task-list-demo',
  title: 'Task list',
  path: '/task-list',
  // Load saved progress before rendering any step (including the task list hub)
  onAccess: [
    access({
      effects: [loadDraftAnswers(), loadSavedAnswers()],
    }),
  ],
  steps: [overviewStep, tasksStep, additionalNeedsStep, checkAnswersStep, confirmationStep],
  // Multi-step sections modelled as child journeys
  children: [yourDetailsJourney, visitPreferencesJourney],
})

export const dependencies: PatternDependencies = { answerStore: new AnswerStore() }

export default createForgePackage<PatternDependencies>({ journey: taskListDemoJourney })
