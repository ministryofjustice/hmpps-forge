import { journey, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { PatternEffects } from '../../effects'
import { overviewStep } from './overview/step'
import { tasksStep } from './tasks/step'
import { yourDetailsJourney } from './your-details/journey'
import { visitPreferencesJourney } from './visit-preferences/journey'
import { additionalNeedsStep } from './additional-needs/step'
import { checkAnswersStep } from './check-answers/step'
import { confirmationStep } from './confirmation/step'

export const taskListDemoJourney = journey({
  code: 'task-list-demo',
  title: 'Task list',
  path: '/task-list',
  // Load saved progress before rendering any step (including the task list hub)
  onAccess: [
    access({
      effects: [PatternEffects.LoadDraftAnswers('task-list')],
    }),
  ],
  steps: [overviewStep, tasksStep, additionalNeedsStep, checkAnswersStep, confirmationStep],
  // Multi-step sections modelled as child journeys
  children: [yourDetailsJourney, visitPreferencesJourney],
})
