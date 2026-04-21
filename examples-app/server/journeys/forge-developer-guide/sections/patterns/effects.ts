import {
  defineEffectFunctions,
  EffectFunctionExpr,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import type { GuideDeps } from '../../effects'
import type { PatternEffectContext } from './context.type'

/**
 * Shared effects used by every pattern demo. Committed answers are persisted
 * through the injected FormDataStore (Redis-backed). Drafts live in the
 * express session under `session.patternDrafts[patternCode]` so they remain
 * isolated from committed state.
 */
export interface PatternEffectShape {
  /** Copies previously stored answers for this pattern into the form context on access. */
  LoadAnswers: (patternCode: string) => EffectFunctionExpr

  /** Copies previously stored draft answers for this pattern into the form context on access. */
  LoadDraftAnswers: (patternCode: string) => EffectFunctionExpr

  /** Persists the current answers into the session under the pattern's code. */
  SaveAnswers: (patternCode: string) => EffectFunctionExpr

  /** Persists the current answers into the session as a draft, kept separately from committed answers. */
  SaveDraftAnswers: (patternCode: string) => EffectFunctionExpr

  /** Records in the session whether this pattern has been submitted. */
  SaveSubmitStateToSession: (patternCode: string, submitted: boolean) => EffectFunctionExpr

  /** Clears stored answers for this pattern (used after confirmation / reset). */
  ClearAnswers: (patternCode: string) => EffectFunctionExpr

  /** Clears draft answers for this pattern (used after committing drafts to the store). */
  ClearDraftAnswers: (patternCode: string) => EffectFunctionExpr

  /** Writes a fixed set of example answers into the session and form context, for demos that need a pre-populated starting state. */
  SeedAnswers: (patternCode: string, answers: Record<string, unknown>) => EffectFunctionExpr

  /** Writes a fixed set of example answers into the session draft namespace and form context, for demos that need a pre-populated in-progress state. */
  SeedDraftAnswers: (patternCode: string, answers: Record<string, unknown>) => EffectFunctionExpr

  /** Bundles temporary field answers into an object and appends it to a collection array. Clears the temporary fields afterwards. */
  AddItemToCollection: (collectionCode: string, fieldCodes: string[]) => EffectFunctionExpr

  /** Removes an item from a collection array by its index, read from the 'remove' query parameter. */
  RemoveItemFromCollection: (collectionCode: string) => EffectFunctionExpr

  /** Sets a single answer value in the form context. Useful for status tracking or computed values that aren't form fields. */
  SetAnswer: (code: string, value: unknown) => EffectFunctionExpr

  /** Reads the ':index' route parameter, extracts the item at that position from the collection, sets each field as an answer, and stores the edit index in the session. */
  LoadItemForEdit: (
    patternCode: string,
    collectionCode: string,
    fieldCodes: string[],
  ) => EffectFunctionExpr

  /** Reads the stored edit index from the session, bundles the current field answers into an object, and replaces the item at that index in the collection. Clears the stored edit index afterwards. */
  EditItemInCollection: (
    patternCode: string,
    collectionCode: string,
    fieldCodes: string[],
  ) => EffectFunctionExpr
}

export const { effects: PatternEffects, implementations: PatternEffectsImplementations } =
  defineEffectFunctions<PatternEffectShape, GuideDeps>({
    LoadAnswers:
      (deps: GuideDeps) => async (context: PatternEffectContext, patternCode: string) => {
        const sessionId = context.getSession()?.id

        if (!sessionId) {
          return
        }

        const stored = await deps.formDataStore.get(sessionId, patternCode)

        if (!stored) {
          return
        }

        for (const [code, value] of Object.entries(stored)) {
          if (!context.hasAnswer(code)) {
            context.setAnswer(code, value)
          }
        }
      },

    LoadDraftAnswers: () => (context: PatternEffectContext, patternCode: string) => {
      const stored = context.getSession()?.patternDrafts?.[patternCode]

      if (!stored) {
        return
      }

      for (const [code, value] of Object.entries(stored)) {
        if (!context.hasAnswer(code)) {
          context.setAnswer(code, value)
        }
      }
    },

    SaveAnswers:
      (deps: GuideDeps) => async (context: PatternEffectContext, patternCode: string) => {
        const sessionId = context.getSession()?.id

        if (!sessionId) {
          return
        }

        const fieldsToClear = context.getFieldsToClear()

        for (const field of fieldsToClear) {
          context.clearAnswer(field)
        }

        await deps.formDataStore.set(sessionId, patternCode, context.getAllAnswers())
      },

    SaveDraftAnswers: () => (context: PatternEffectContext, patternCode: string) => {
      const session = context.getSession()

      if (!session) {
        return
      }

      if (!session.patternDrafts) {
        session.patternDrafts = {}
      }

      session.patternDrafts[patternCode] = {
        ...session.patternDrafts[patternCode],
        ...context.getAllAnswers(),
      }
    },

    SaveSubmitStateToSession:
      () => (context: PatternEffectContext, patternCode: string, submitted: boolean) => {
        const session = context.getSession()

        if (!session) {
          return
        }

        if (!session.patternSubmitted) {
          session.patternSubmitted = {}
        }

        session.patternSubmitted[patternCode] = submitted
      },

    ClearAnswers:
      (deps: GuideDeps) => async (context: PatternEffectContext, patternCode: string) => {
        const sessionId = context.getSession()?.id

        if (!sessionId) {
          return
        }

        await deps.formDataStore.delete(sessionId, patternCode)

        for (const key of Object.keys(context.getAllAnswers())) {
          context.clearAnswer(key)
        }
      },

    ClearDraftAnswers: () => {
      return (context: PatternEffectContext, patternCode: string) => {
        const session = context.getSession()

        if (session?.patternDrafts) {
          delete session.patternDrafts[patternCode]
        }

        for (const key of Object.keys(context.getAllAnswers())) {
          context.clearAnswer(key)
        }
      }
    },
    SeedDraftAnswers:
      () =>
      (context: PatternEffectContext, patternCode: string, answers: Record<string, unknown>) => {
        const session = context.getSession()

        if (session) {
          if (!session.patternDrafts) {
            session.patternDrafts = {}
          }

          session.patternDrafts[patternCode] = {
            ...session.patternDrafts[patternCode],
            ...answers,
          }
        }

        for (const [code, value] of Object.entries(answers)) {
          context.setAnswer(code, value)
        }
      },

    AddItemToCollection:
      () => (context: PatternEffectContext, collectionCode: string, fieldCodes: string[]) => {
        const item: Record<string, unknown> = {}

        for (const code of fieldCodes) {
          const value = context.getAnswer(code)

          if (value !== undefined) {
            item[code] = value
          }
        }

        const collection = (context.getAnswer(collectionCode) ?? []) as unknown[]
        context.setAnswer(collectionCode, [...collection, item])

        for (const code of fieldCodes) {
          context.setAnswer(code, undefined)
        }
      },

    RemoveItemFromCollection: () => (context: PatternEffectContext, collectionCode: string) => {
      const indexStr = context.getQueryParam('remove')

      if (indexStr === undefined) {
        return
      }

      const index = parseInt(String(indexStr), 10)
      const collection = (context.getAnswer(collectionCode) ?? []) as unknown[]

      if (index >= 0 && index < collection.length) {
        const updated = [...collection]
        updated.splice(index, 1)
        context.setAnswer(collectionCode, updated)
      }
    },

    SetAnswer: () => (context: PatternEffectContext, code: string, value: unknown) => {
      context.setAnswer(code, value)
    },

    LoadItemForEdit:
      () =>
      (
        context: PatternEffectContext,
        patternCode: string,
        collectionCode: string,
        fieldCodes: string[],
      ) => {
        const indexStr = context.getRequestParam('index')

        if (indexStr === undefined) {
          return
        }

        const index = parseInt(indexStr, 10)
        const collection = (context.getAnswer(collectionCode) ?? []) as Record<string, unknown>[]

        if (Number.isNaN(index) || index < 0 || index >= collection.length) {
          return
        }

        const item = collection[index]

        for (const code of fieldCodes) {
          if (item[code] !== undefined) {
            context.setAnswer(code, item[code])
          }
        }

        const session = context.getSession()

        if (session) {
          if (!session.patternDrafts) {
            session.patternDrafts = {}
          }

          if (!session.patternDrafts[patternCode]) {
            session.patternDrafts[patternCode] = {}
          }

          session.patternDrafts[patternCode].editingIndex = index
        }
      },

    EditItemInCollection:
      () =>
      (
        context: PatternEffectContext,
        patternCode: string,
        collectionCode: string,
        fieldCodes: string[],
      ) => {
        const session = context.getSession()
        const editingIndex = session?.patternDrafts?.[patternCode]?.editingIndex

        if (editingIndex === undefined) {
          return
        }

        const index = Number(editingIndex)
        const collection = (context.getAnswer(collectionCode) ?? []) as Record<string, unknown>[]

        if (index < 0 || index >= collection.length) {
          return
        }

        const item: Record<string, unknown> = {}

        for (const code of fieldCodes) {
          const value = context.getAnswer(code)

          if (value !== undefined) {
            item[code] = value
          }
        }

        const updated = [...collection]
        updated[index] = item
        context.setAnswer(collectionCode, updated)

        for (const code of fieldCodes) {
          context.setAnswer(code, undefined)
        }

        if (session?.patternDrafts?.[patternCode]) {
          delete session.patternDrafts[patternCode].editingIndex
        }
      },
  })
