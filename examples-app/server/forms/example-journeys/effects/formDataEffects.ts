import { defineEffectFunctions, EffectFunctionExpr } from '@ministryofjustice/hmpps-forge/core/authoring'
import type { ExampleJourneyContext, ExampleJourneyDeps } from '../context.type'

// FORGE-EXAMPLE: defineEffectFunctions uses a shape interface + deps type to produce
// typed builder functions (for form authoring) and implementations (for runtime).
// The (deps) => (context, ...args) => pattern enables dependency injection.
export interface FormDataEffectShape {
  /** Loads previously saved answers from the data store into the form context */
  LoadAnswers: (formCode: string) => EffectFunctionExpr

  /** Persists the current form answers to the data store */
  SaveAnswers: (formCode: string) => EffectFunctionExpr

  /** Deletes all saved answers for a form from the data store */
  ClearAnswers: (formCode: string) => EffectFunctionExpr
}

export const { effects: FormDataEffects, implementations: FormDataEffectsImplementations } = defineEffectFunctions<
  FormDataEffectShape,
  ExampleJourneyDeps
>({
  LoadAnswers: deps => async (context: ExampleJourneyContext, formCode: string) => {
    const sessionId = context.getSession().id

    if (!sessionId) {
      return
    }

    const savedAnswers = await deps.formDataStore.get(sessionId, formCode)

    if (savedAnswers) {
      for (const [code, value] of Object.entries(savedAnswers)) {
        if (!context.hasAnswer(code)) {
          context.setAnswer(code, value)
        }
      }
    }
  },

  SaveAnswers: deps => async (context: ExampleJourneyContext, formCode: string) => {
    const sessionId = context.getSession().id

    if (!sessionId) {
      return
    }

    const currentAnswers = context.getAllAnswers()

    await deps.formDataStore.set(sessionId, formCode, currentAnswers)
  },

  ClearAnswers: deps => async (context: ExampleJourneyContext, formCode: string) => {
    const sessionId = context.getSession().id

    if (!sessionId) {
      return
    }

    await deps.formDataStore.delete(sessionId, formCode)
  },
})
