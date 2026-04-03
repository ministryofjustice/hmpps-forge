import { step, submitTransition, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../effects'
import {
  panel,
  whatHappensNextHeading,
  confirmationEmailBody,
  appointmentDetailsInset,
  bookAnotherButton,
} from './blocks'

export const confirmationStep = step({
  path: '/confirmation',
  title: 'Appointment booked',
  blocks: [
    panel,
    whatHappensNextHeading,
    confirmationEmailBody,
    appointmentDetailsInset,
    bookAnotherButton,
  ],
  onSubmission: [
    submitTransition({
      validate: false,
      onAlways: {
        effects: [ExampleJourneysEffects.ClearAnswers('booking-form')],
        next: [redirect({ goto: 'type' })],
      },
    }),
  ],
})
