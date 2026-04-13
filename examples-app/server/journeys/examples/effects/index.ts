import { FormDataEffects, FormDataEffectsImplementations } from './formDataEffects'
import { AppointmentEffects, AppointmentEffectsImplementations } from './appointmentEffects'
import {
  TravelEffects,
  TravelEffectsImplementations,
} from '../travel-declaration/effects/travelEffects'

// FORGE-EXAMPLE: Dependencies are injected at registration time via registerPackage(pkg, deps)
export type { ExampleJourneyDeps } from '../context.type'

export const ExampleJourneysEffects = {
  ...FormDataEffects,
  ...AppointmentEffects,
  ...TravelEffects,
}

export const ExampleJourneyEffectsImplementations = {
  ...FormDataEffectsImplementations,
  ...AppointmentEffectsImplementations,
  ...TravelEffectsImplementations,
}
