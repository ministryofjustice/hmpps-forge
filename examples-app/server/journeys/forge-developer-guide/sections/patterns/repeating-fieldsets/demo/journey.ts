import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { overviewStep } from './overview/step'
import { householdMembersStep } from './household-members/step'
import { checkAnswersStep } from './check-answers/step'
import { confirmationStep } from './confirmation/step'

export const repeatingFieldsetsDemoJourney = journey({
  code: 'repeating-fieldsets-demo',
  title: 'Repeating fieldsets',
  path: '/repeating-fieldsets',
  steps: [overviewStep, householdMembersStep, checkAnswersStep, confirmationStep],
})
