import { journey, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { PatternEffects } from '../../effects'
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
      effects: [PatternEffects.LoadDraftAnswers('branching')],
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
