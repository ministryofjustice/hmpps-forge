import { redirect, step, submitTransition } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../effects'
import { additionalInfoField, continueButton, heading, whatToExpectDetails } from './blocks'

export const additionalInfoStep = step({
  code: 'additional-info',
  path: '/additional-info',
  title: 'Additional information',
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
