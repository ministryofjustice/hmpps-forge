import { journey, access, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadDraftAnswers, loadSavedAnswers } from './effects'
import type { PatternDependencies } from './effects'
import { AnswerStore } from './AnswerStore'
import { AddressLookup } from './AddressLookup'
import { overviewStep } from './overview'
import { findAddressStep } from './find-address'
import { checkAnswersStep } from './check-answers'
import { confirmationStep } from './confirmation'

export const preFillDemoJourney = journey({
  code: 'pre-fill-demo',
  title: 'Pre-fill from an external system',
  path: '/pre-fill',
  onAccess: [
    access({
      effects: [loadDraftAnswers(), loadSavedAnswers()],
    }),
  ],
  steps: [overviewStep, findAddressStep, checkAnswersStep, confirmationStep],
})

export const dependencies: PatternDependencies = {
  answerStore: new AnswerStore(),
  addressLookup: new AddressLookup(),
}

export default createForgePackage<PatternDependencies>({ journey: preFillDemoJourney })
