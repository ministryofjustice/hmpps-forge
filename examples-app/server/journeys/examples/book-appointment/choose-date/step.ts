import { step, submitTransition, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../effects'
import {
  appointmentDateField,
  weekdayWarning,
  appointmentTypeInset,
  continueButton,
} from './blocks'

export const dateStep = step({
  code: 'choose-date',
  path: '/choose-date',
  title: 'Appointment date',
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
