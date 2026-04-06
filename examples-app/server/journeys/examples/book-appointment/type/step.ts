import { step, submitTransition, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../effects'
import { appointmentTypeField, continueButton } from './blocks'

export const typeStep = step({
  code: 'appointment-type',
  path: '/type',
  title: 'What type of appointment do you need?',
  isEntryPoint: true,
  blocks: [appointmentTypeField, continueButton],
  onSubmission: [
    submitTransition({
      validate: true,
      onValid: {
        effects: [ExampleJourneysEffects.SaveAnswers('booking-form')],
        next: [redirect({ goto: 'your-details' })],
      },
    }),
  ],
})
