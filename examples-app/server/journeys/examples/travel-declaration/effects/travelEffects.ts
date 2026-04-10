import {
  defineEffectFunctions,
  EffectFunctionExpr,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {ExampleJourneyDeps} from "../../context.type";
import {TravelDeclarationContext, Trip} from "./context.type";

// FORGE-EXAMPLE: These effects manage trips as an answer array.
// AddTrip reads individual trip field answers, bundles them into a Trip object,
// and appends it to the trips answer array.
// RemoveTrip removes a trip by index.
export interface TravelEffectShape {
  /** Collects trip field answers into a Trip object and appends to the trips array */
  AddTrip: () => EffectFunctionExpr

  /** Removes a trip from the array by its index (passed via query param) */
  RemoveTrip: () => EffectFunctionExpr
}

const TRIP_FIELD_CODES = [
  'tripCountry',
  'tripDepartureDate',
  'tripReturnDate',
  'tripReason',
  'tripDetails',
] as const

export const { effects: TravelEffects, implementations: TravelEffectsImplementations } =
  defineEffectFunctions<TravelEffectShape, ExampleJourneyDeps>({
    AddTrip: (deps: ExampleJourneyDeps) => async (context: TravelDeclarationContext) => {
      const trip: Trip = {
        country: context.getAnswer('tripCountry'),
        departureDate: context.getAnswer('tripDepartureDate'),
        returnDate: context.getAnswer('tripReturnDate'),
        reason: context.getAnswer('tripReason'),
        details: context.getAnswer('tripDetails') || undefined,
      }

      const trips = context.getAnswer('trips') ?? []
      context.setAnswer('trips', [...trips, trip])

      // Clear these down just so we don't store some junk temporary answers
      // in a real service, you'd just filter these out, but we're using a generic save action for our examples
      for (const code of TRIP_FIELD_CODES) {
        context.setAnswer(code, undefined)
      }
    },

    RemoveTrip: (deps: ExampleJourneyDeps) => async (context: TravelDeclarationContext) => {
      const indexStr = context.getQueryParam('remove') as string

      if (indexStr === undefined) {
        return
      }

      const index = parseInt(indexStr, 10)
      const trips = context.getAnswer('trips') ?? []

      if (index >= 0 && index < trips.length) {
        trips.splice(index, 1)
        context.setAnswer('trips', trips)
      }
    },
  })
