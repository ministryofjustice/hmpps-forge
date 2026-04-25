import { journey, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { PatternEffects } from '../../effects'
import { overviewStep } from './overview/step'
import { fullNameStep } from './full-name/step'
import { emailAddressStep } from './email-address/step'
import { contactPreferenceStep } from './contact-preference/step'
import { checkAnswersStep } from './check-answers/step'
import { confirmationStep } from './confirmation/step'

export const editAndReturnDemoJourney = journey({
  code: 'edit-and-return-demo',
  title: 'Edit and return',
  path: '/edit-and-return',
  onAccess: [
    access({
      effects: [PatternEffects.LoadDraftAnswers('edit-and-return')],
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
