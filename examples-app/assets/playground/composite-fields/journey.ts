import { journey, access, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadDraftAnswers, loadSavedAnswers } from './effects'
import type { PatternDependencies } from './effects'
import { AnswerStore } from './AnswerStore'
import { overviewStep } from './overview'
import { dateOfBirthStep } from './date-of-birth'
import { addressStep } from './address'
import { checkAnswersStep } from './check-answers'
import { confirmationStep } from './confirmation'

// The demo loads stored draft answers on access so every step is pre-filled when the
// user navigates back via a change link on the summary.
export const compositeFieldsDemoJourney = journey({
  code: 'composite-fields-demo',
  title: 'Multi-part composite fields',
  path: '/composite-fields',
  onAccess: [
    access({
      effects: [loadDraftAnswers(), loadSavedAnswers()],
    }),
  ],
  steps: [overviewStep, dateOfBirthStep, addressStep, checkAnswersStep, confirmationStep],
})

export const dependencies: PatternDependencies = { answerStore: new AnswerStore() }

export default createForgePackage<PatternDependencies>({ journey: compositeFieldsDemoJourney })
