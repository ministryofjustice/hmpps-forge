import { FormDataEffects, FormDataEffectsImplementations } from './formDataEffects'

// FORGE-EXAMPLE: Dependencies are injected at registration time via registerPackage(pkg, deps)
export type { ExampleJourneyDeps } from '../context.type'

export const ExampleJourneysEffects = {
  ...FormDataEffects,
}

export const ExampleJourneyEffectsImplementations = {
  ...FormDataEffectsImplementations,
}
