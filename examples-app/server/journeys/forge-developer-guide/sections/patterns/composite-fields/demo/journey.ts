import { journey, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { PatternEffects } from '../../effects'
import { overviewStep } from './overview/step'
import { dateOfBirthStep } from './date-of-birth/step'
import { addressStep } from './address/step'
import { checkAnswersStep } from './check-answers/step'
import { confirmationStep } from './confirmation/step'

// The demo loads stored draft answers on access so every step is pre-filled when the
// user navigates back via a change link on the summary.
export const compositeFieldsDemoJourney = journey({
  code: 'composite-fields-demo',
  title: 'Multi-part composite fields',
  path: '/composite-fields',
  onAccess: [
    access({
      effects: [PatternEffects.LoadDraftAnswers('composite-fields')],
    }),
  ],
  steps: [overviewStep, dateOfBirthStep, addressStep, checkAnswersStep, confirmationStep],
})
