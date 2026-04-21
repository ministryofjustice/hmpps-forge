import { journey, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { PatternEffects } from '../../effects'
import { overviewStep } from './overview/step'
import { heardFromStep } from './heard-from/step'
import { checkAnswersStep } from './check-answers/step'
import { confirmationStep } from './confirmation/step'

// The demo loads any stored draft answers on access so the radio and any revealed
// follow-up inputs are pre-filled when the user returns via the change link.
export const revealFieldsDemoJourney = journey({
  code: 'reveal-fields-demo',
  title: 'Reveal fields',
  path: '/reveal-fields',
  onAccess: [
    access({
      effects: [PatternEffects.LoadDraftAnswers('reveal-fields')],
    }),
  ],
  steps: [overviewStep, heardFromStep, checkAnswersStep, confirmationStep],
})
