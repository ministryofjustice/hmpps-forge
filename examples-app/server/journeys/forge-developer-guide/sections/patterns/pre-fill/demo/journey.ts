import { journey, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { PatternEffects } from '../../effects'
import { overviewStep } from './overview/step'
import { findAddressStep } from './find-address/step'
import { checkAnswersStep } from './check-answers/step'
import { confirmationStep } from './confirmation/step'

export const preFillDemoJourney = journey({
  code: 'pre-fill-demo',
  title: 'Pre-fill from an external system',
  path: '/pre-fill',
  onAccess: [
    access({
      effects: [PatternEffects.LoadDraftAnswers('pre-fill')],
    }),
  ],
  steps: [overviewStep, findAddressStep, checkAnswersStep, confirmationStep],
})
