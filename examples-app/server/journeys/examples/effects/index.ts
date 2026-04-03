import { FormDataEffects, FormDataEffectsImplementations } from './formDataEffects'
import { AppointmentEffects, AppointmentEffectsImplementations } from './appointmentEffects'

// FORGE-EXAMPLE: Dependencies are injected at registration time via registerPackage(pkg, deps)
export type { ExampleJourneyDeps } from '../context.type'

export const ExampleJourneysEffects = {
  ...FormDataEffects,
  ...AppointmentEffects,
}

export const ExampleJourneyEffectsImplementations = {
  ...FormDataEffectsImplementations,
  ...AppointmentEffectsImplementations,
}
