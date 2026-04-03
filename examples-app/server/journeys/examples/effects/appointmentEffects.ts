import {
  defineEffectFunctions,
  EffectFunctionExpr,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import type { ExampleJourneyContext, ExampleJourneyDeps } from '../context.type'

// FORGE-EXAMPLE: This effect loads data from an external API and stores it in the form context
// via context.setData(). The data is then accessible in the form definition using Data('key')
// references, enabling data-driven components like dynamic select dropdowns.
export interface AppointmentEffectShape {
  /** Loads available time slots from the appointment API based on current answers */
  LoadAppointmentSlots: () => EffectFunctionExpr
}

export const { effects: AppointmentEffects, implementations: AppointmentEffectsImplementations } =
  defineEffectFunctions<AppointmentEffectShape, ExampleJourneyDeps>({
    LoadAppointmentSlots: deps => async (context: ExampleJourneyContext) => {
      const date = context.getAnswer('appointmentDate') as string | undefined
      const type = context.getAnswer('appointmentType') as string | undefined

      if (!date || !type) {
        return
      }

      const slots =
        type === 'in-person'
          ? await deps.appointmentApi.getInPersonSlots(
              context.getAnswer('location') as string,
              date,
            )
          : await deps.appointmentApi.getVirtualSlots(date)

      context.setData('availableSlots', slots)
    },
  })
