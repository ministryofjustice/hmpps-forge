import { step, submitTransition, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../effects'
import {
  appointmentDateField,
  weekdayWarning,
  appointmentTypeInset,
  continueButton,
} from './blocks'

export const dateStep = step({
  path: '/choose-date',
  title: 'Appointment date',
  backlink: 'your-details',
  blocks: [appointmentDateField, weekdayWarning, appointmentTypeInset, continueButton],
  onSubmission: [
    submitTransition({
      validate: true,
      onValid: {
        effects: [ExampleJourneysEffects.SaveAnswers('booking-form')],
        next: [redirect({ goto: 'choose-time' })],
      },
    }),
  ],
})
