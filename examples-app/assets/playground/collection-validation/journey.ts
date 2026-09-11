import { journey, access, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadDraftAnswers, loadSavedAnswers, loadPlanGoals } from './effects'
import type { PatternDependencies } from './effects'
import { AnswerStore } from './AnswerStore'
import { overviewStep } from './overview'
import { agreePlanStep } from './agree-plan'
import { managePlanStep } from './manage-plan'
import { confirmationStep } from './confirmation'

export const collectionValidationDemoJourney = journey({
  code: 'collection-validation-demo',
  title: 'Validating collections with iterators',
  path: '/collection-validation',
  onAccess: [
    access({
      effects: [
        loadDraftAnswers(),
        loadSavedAnswers(),
        loadPlanGoals(),
      ],
    }),
  ],
  steps: [overviewStep, managePlanStep, agreePlanStep, confirmationStep],
})

export const dependencies: PatternDependencies = { answerStore: new AnswerStore() }

export default createForgePackage<PatternDependencies>({ journey: collectionValidationDemoJourney })
