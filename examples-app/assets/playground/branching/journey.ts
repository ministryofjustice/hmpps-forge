import { journey, access, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadDraftAnswers } from './effects'
import type { PatternDependencies } from './effects'
import { AnswerStore } from './AnswerStore'
import { overviewStep } from './overview/step'
import { visitTypeStep } from './visit-type/step'
import { locationStep } from './location/step'
import { videoEmailStep } from './video-email/step'
import { phoneNumberStep } from './phone-number/step'
import { checkAnswersStep } from './check-answers/step'
import { confirmationStep } from './confirmation/step'

// The demo loads any stored draft answers on every access so switching between
// branches preserves earlier input; the summary page filters rows to the
// branch the user is currently on.
export const branchingDemoJourney = journey({
  code: 'branching-demo',
  title: 'Branching based on an earlier answer',
  path: '/branching',
  onAccess: [
    access({
      effects: [loadDraftAnswers('branching')],
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
