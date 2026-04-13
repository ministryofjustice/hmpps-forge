import { journey, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../effects'
import { travelOverviewStep } from './steps/travel-overview/step'
import { addTripStep } from './steps/add-trip/step'
import { yourTripsStep } from './steps/your-trips/step'
import { checkAnswersStep } from './steps/check-answers/step'
import { confirmationStep } from './steps/confirmation/step'

// FORGE-EXAMPLE: This journey demonstrates iterators, CollectionBlock, static step data,
// the "add another" pattern with action hooks, and conditional routing.
export const travelDeclarationJourney = journey({
  code: 'travel-declaration',
  title: 'Declare your overseas travel',
  path: '/travel-declaration',
  view: {
    locals: { serviceName: 'Declare your overseas travel' },
  },
  onAccess: [
    access({
      effects: [ExampleJourneysEffects.LoadAnswers('travel-form')],
    }),
  ],
  steps: [travelOverviewStep, addTripStep, yourTripsStep, checkAnswersStep, confirmationStep],
})
