import { journey, access, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadDraftAnswers, loadSavedAnswers } from './effects'
import type { PatternDependencies } from './effects'
import { AnswerStore } from './AnswerStore'
import { overviewStep } from './overview'
import { heardFromStep } from './heard-from'
import { checkAnswersStep } from './check-answers'
import { confirmationStep } from './confirmation'

// The demo loads any stored draft answers on access so the radio and any revealed
// follow-up inputs are pre-filled when the user returns via the change link.
export const revealFieldsDemoJourney = journey({
  code: 'reveal-fields-demo',
  title: 'Reveal fields',
  path: '/reveal-fields',
  onAccess: [
    access({
      effects: [loadDraftAnswers(), loadSavedAnswers()],
    }),
  ],
  steps: [overviewStep, heardFromStep, checkAnswersStep, confirmationStep],
})

export const dependencies: PatternDependencies = { answerStore: new AnswerStore() }

export default createForgePackage<PatternDependencies>({ journey: revealFieldsDemoJourney })
