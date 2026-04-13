import { step, submit, access, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../effects'
import { appointmentTimeField, continueButton } from './blocks'

// FORGE-EXAMPLE: The onAccess effect loads data from an external API before the step renders.
// LoadAppointmentSlots reads the user's answers (date, type, location) from context, calls
// the appointment API, and stores the results via context.setData('availableSlots').
// The select field then reads Data('availableSlots') to build its dropdown items dynamically.
export const timeStep = step({
  code: 'choose-time',
  path: '/choose-time',
  title: 'Choose a time',
  onAccess: [
    access({
      effects: [ExampleJourneysEffects.LoadAppointmentSlots()],
    }),
  ],
  blocks: [appointmentTimeField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [ExampleJourneysEffects.SaveAnswers('booking-form')],
        next: [redirect({ goto: 'additional-info' })],
      },
    }),
  ],
})
