import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { buildingJourneysOverviewStep } from './overview/step'
import { definingAJourneyStep } from './defining-a-journey/step'
import { registeringAJourneyStep } from './registering-a-journey/step'
import { definingStepsStep } from './defining-steps/step'
import { definingBlocksAndFieldsStep } from './blocks/step'
import { routingAndEntryPointsStep } from './routing-and-entry-points/step'
import { reachabilityStep } from './reachability/step'
import { navigationTreeStep } from './navigation-tree/step'
import { hooksAndLifecycleStep } from './hooks-and-lifecycle/step'
import { definitionsAndRuntimeStep } from './definitions-and-runtime/step'
import { loadingSavingAndRedirectingStep } from './loading-saving-and-redirecting/step'
import { shapingDataStep } from './shaping-data/step'
import { validationStep } from './validation/step'
import { testingStep } from './testing/step'

export const buildingJourneysJourney = journey({
  code: 'building-journeys',
  title: 'Building journeys',
  path: '/building-journeys',
  view: {
    locals: { showBackToTop: true },
  },
  steps: [
    buildingJourneysOverviewStep,
    definingAJourneyStep,
    definingStepsStep,
    definingBlocksAndFieldsStep,
    registeringAJourneyStep,
    routingAndEntryPointsStep,
    reachabilityStep,
    navigationTreeStep,
    hooksAndLifecycleStep,
    definitionsAndRuntimeStep,
    loadingSavingAndRedirectingStep,
    shapingDataStep,
    validationStep,
    testingStep,
  ],
})
