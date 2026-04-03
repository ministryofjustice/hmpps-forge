import { journey, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { feedbackJourney } from './feedback/form'
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
    children: [feedbackJourney],
  }),
  functions: {
    ...ExampleJourneyEffectsImplementations,
  },
})
