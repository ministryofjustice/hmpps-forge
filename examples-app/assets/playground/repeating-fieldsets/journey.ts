import { journey, access, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadDraftAnswers, loadSavedAnswers, loadHouseholdMembers } from './effects'
import type { PatternDependencies } from './effects'
import { AnswerStore } from './AnswerStore'
import { overviewStep } from './overview'
import { householdMembersStep } from './household-members'
import { checkAnswersStep } from './check-answers'
import { confirmationStep } from './confirmation'

export const repeatingFieldsetsDemoJourney = journey({
  code: 'repeating-fieldsets-demo',
  title: 'Repeating fieldsets',
  path: '/repeating-fieldsets',
  onAccess: [
    access({
      effects: [
        loadDraftAnswers(),
        loadSavedAnswers(),
        loadHouseholdMembers(),
      ],
    }),
  ],
  steps: [overviewStep, householdMembersStep, checkAnswersStep, confirmationStep],
})

export const dependencies: PatternDependencies = { answerStore: new AnswerStore() }

export default createForgePackage<PatternDependencies>({ journey: repeatingFieldsetsDemoJourney })
