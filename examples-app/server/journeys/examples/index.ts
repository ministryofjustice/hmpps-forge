import { journey, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { hubStep } from './hub/step'
import { feedbackJourney } from './feedback/journey'
import { bookAppointmentJourney } from './book-appointment/journey'
import { ExampleJourneyDeps, ExampleJourneyEffectsImplementations } from './effects'

// FORGE-EXAMPLE: createForgePackage bundles a journey tree with its function implementations.
// The generic <ExampleJourneyDeps> declares what dependencies the effects expect at runtime.
export default createForgePackage<ExampleJourneyDeps>({
  journey: journey({
    code: 'example-journeys',
    title: 'Example Journeys',
    path: '/example-journeys',
    view: {
      template: 'partials/form-step',
    },
    steps: [hubStep],
    children: [feedbackJourney, bookAppointmentJourney],
  }),
  functions: {
    ...ExampleJourneyEffectsImplementations,
  },
})
