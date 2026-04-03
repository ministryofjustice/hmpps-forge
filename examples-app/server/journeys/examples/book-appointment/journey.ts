import { journey, accessTransition } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../effects'
import { typeStep } from './type/step'
import { detailsStep } from './your-details/step'
import { locationStep } from './location/step'
import { dateStep } from './choose-date/step'
import { timeStep } from './choose-time/step'
import { additionalInfoStep } from './additional-info/step'
import { checkAnswersStep } from './check-answers/step'
import { confirmationStep } from './confirmation/step'

// FORGE-EXAMPLE: The journey groups steps and sets shared config.
// view.locals passes template variables (like serviceName) down to all steps.
// onAccess loads saved answers on every GET so users can resume incomplete forms.
export const bookAppointmentJourney = journey({
  code: 'book-appointment',
  title: 'Book an appointment',
  path: '/book-appointment',
  view: {
    locals: { serviceName: 'Book an appointment' },
  },
  onAccess: [
    accessTransition({
      effects: [ExampleJourneysEffects.LoadAnswers('booking-form')],
    }),
  ],
  steps: [
    typeStep,
    detailsStep,
    locationStep,
    dateStep,
    timeStep,
    additionalInfoStep,
    checkAnswersStep,
    confirmationStep,
  ],
})
