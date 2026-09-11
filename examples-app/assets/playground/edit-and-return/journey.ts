import { journey, access, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadDraftAnswers, loadSavedAnswers } from './effects'
import type { PatternDependencies } from './effects'
import { AnswerStore } from './AnswerStore'
import { overviewStep } from './overview'
import { fullNameStep } from './full-name'
import { emailAddressStep } from './email-address'
import { contactPreferenceStep } from './contact-preference'
import { checkAnswersStep } from './check-answers'
import { confirmationStep } from './confirmation'

export const editAndReturnDemoJourney = journey({
  code: 'edit-and-return-demo',
  title: 'Edit and return',
  path: '/edit-and-return',
  onAccess: [
    access({
      effects: [loadDraftAnswers(), loadSavedAnswers()],
    }),
  ],
  steps: [
    overviewStep,
    fullNameStep,
    emailAddressStep,
    contactPreferenceStep,
    checkAnswersStep,
    confirmationStep,
  ],
})

export const dependencies: PatternDependencies = { answerStore: new AnswerStore() }

export default createForgePackage<PatternDependencies>({ journey: editAndReturnDemoJourney })
