import { journey, access, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadDraftAnswers, loadSavedAnswers } from './effects'
import type { PatternDependencies } from './effects'
import { AnswerStore } from './AnswerStore'
import { overviewStep } from './overview'
import { visitTypeStep } from './visit-type'
import { locationStep } from './location'
import { videoEmailStep } from './video-email'
import { phoneNumberStep } from './phone-number'
import { checkAnswersStep } from './check-answers'
import { confirmationStep } from './confirmation'

// The demo loads any stored draft answers on every access so switching between
// branches preserves earlier input; the summary page filters rows to the
// branch the user is currently on.
export const branchingDemoJourney = journey({
  code: 'branching-demo',
  title: 'Branching based on an earlier answer',
  path: '/branching',
  onAccess: [
    access({
      effects: [loadDraftAnswers(), loadSavedAnswers()],
    }),
  ],
  steps: [
    overviewStep,
    visitTypeStep,
    locationStep,
    videoEmailStep,
    phoneNumberStep,
    checkAnswersStep,
    confirmationStep,
  ],
})

export const dependencies: PatternDependencies = { answerStore: new AnswerStore() }

export default createForgePackage<PatternDependencies>({ journey: branchingDemoJourney })
