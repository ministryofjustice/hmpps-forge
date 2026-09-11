import { effect } from '@ministryofjustice/hmpps-forge/core/authoring'
import type { AnswerStore } from './AnswerStore'
import type { EffectFunctionContext } from '@ministryofjustice/hmpps-forge/core/authoring'

export type PatternDependencies = {
  answerStore: Pick<AnswerStore, 'save' | 'get' | 'delete'>
}

type PatternSession = {
  draftAnswers?: Record<string, unknown>
}

type PatternEffectContext = EffectFunctionContext<
  Record<string, unknown>,
  Record<string, unknown>,
  PatternSession
>

// Drafts belong to the session; confirmed answers belong to the injected store.
/** Copies previously stored draft answers for this pattern into the form context on access. */
export const loadDraftAnswers = effect({
  name: 'LoadDraftAnswers',
  factory: () => (context: PatternEffectContext) => {
    const stored = context.getSession()?.draftAnswers

    if (!stored) {
      return
    }

    Object.entries(stored).forEach(([code, value]) => {
      if (!context.hasAnswer(code)) {
        context.setAnswer(code, value)
      }
    })
  },
})

/** Loads the confirmed record independently of the session's draft answers. */
export const loadSavedAnswers = effect({
  name: 'LoadSavedAnswers',
  factory: ({ answerStore }: PatternDependencies) => async (context: PatternEffectContext) => {
    const savedAnswers = await answerStore.get()

    context.setData('savedAnswers', savedAnswers)
  },
})

/** Saves confirmed answers through the store, separately from the session draft. */
export const saveAnswers = effect({
  name: 'SaveAnswers',
  factory: ({ answerStore }: PatternDependencies) => async (context: PatternEffectContext) => {
    context.getFieldsToClear().forEach(field => context.clearAnswer(field))

    const answers = context.getAllAnswers()

    await answerStore.save(answers)
    context.setData('savedAnswers', answers)
  },
})

/** Persists the current answers into the session as a draft, kept separately from committed answers. */
export const saveDraftAnswers = effect({
  name: 'SaveDraftAnswers',
  factory: () => (context: PatternEffectContext) => {
    const session = context.getSession()

    if (!session) {
      return
    }

    session.draftAnswers = {
      ...session.draftAnswers,
      ...context.getAllAnswers(),
    }
  },
})

/** Deletes the confirmed record when the pattern explicitly clears its answers. */
export const clearAnswers = effect({
  name: 'ClearAnswers',
  factory: ({ answerStore }: PatternDependencies) => async (context: PatternEffectContext) => {
    await answerStore.delete()
    context.setData('savedAnswers', undefined)
    Object.keys(context.getAllAnswers()).forEach(key => context.clearAnswer(key))
  },
})

/** Clears draft answers for this pattern (used after committing drafts to the store). */
export const clearDraftAnswers = effect({
  name: 'ClearDraftAnswers',
  factory: () => (context: PatternEffectContext) => {
    const session = context.getSession()

    if (session) {
      delete session.draftAnswers
    }

    Object.keys(context.getAllAnswers()).forEach(key => context.clearAnswer(key))
  },
})

/** Records task progress alongside the visitor's draft answers. */
export const setAnswer = effect({
  name: 'SetAnswer',
  factory: () => (context: PatternEffectContext, code: string, value: string) => {
    context.setAnswer(code, value)
  },
})
