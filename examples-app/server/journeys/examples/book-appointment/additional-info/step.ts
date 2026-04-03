import { redirect, step, submitTransition } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../effects'
import { additionalInfoField, continueButton, heading, whatToExpectDetails } from './blocks'

export const additionalInfoStep = step({
  path: '/additional-info',
  title: 'Additional information',
  backlink: 'choose-time',
  blocks: [heading, whatToExpectDetails, additionalInfoField, continueButton],
  onSubmission: [
    submitTransition({
      validate: true,
      onValid: {
        effects: [ExampleJourneysEffects.SaveAnswers('booking-form')],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
})
