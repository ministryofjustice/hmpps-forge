import { effect } from '@ministryofjustice/hmpps-forge/core/authoring'
import type { AnswerStore } from './AnswerStore'
import type { EffectFunctionContext } from '@ministryofjustice/hmpps-forge/core/authoring'

export type PatternDependencies = {
  answerStore: Pick<AnswerStore, 'save' | 'get' | 'delete'>
}

type PatternSession = {
  patternDrafts?: Record<string, Record<string, unknown>>
  patternSubmitted?: Record<string, boolean>
}

type PatternEffectContext = EffectFunctionContext<
  Record<string, unknown>,
  Record<string, unknown>,
  PatternSession
>

// Drafts belong to the session; confirmed answers belong to the injected store.
/** Copies previously stored draft answers for this pattern into the form context on access. */
export const loadDraftAnswers = effect('LoadDraftAnswers', {
  factory: () => (context: PatternEffectContext, patternCode: string) => {
    const stored = context.getSession()?.patternDrafts?.[patternCode]

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

/** Saves confirmed answers through the store, separately from the session draft. */
export const saveAnswers = effect('SaveAnswers', {
  factory: ({ answerStore }: PatternDependencies) => async (context: PatternEffectContext, patternCode: string) => {
    context.getFieldsToClear().forEach(field => context.clearAnswer(field))
    await answerStore.save(patternCode, context.getAllAnswers())
  },
})

/** Persists the current answers into the session as a draft, kept separately from committed answers. */
export const saveDraftAnswers = effect('SaveDraftAnswers', {
  factory: () => (context: PatternEffectContext, patternCode: string) => {
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
})

/** Records in the session whether this pattern has been submitted. */
export const saveSubmitStateToSession = effect('SaveSubmitStateToSession', {
  factory: () => (context: PatternEffectContext, patternCode: string, submitted: boolean) => {
    const session = context.getSession()

    if (!session) {
      return
    }

    if (!session.patternSubmitted) {
      session.patternSubmitted = {}
    }

    session.patternSubmitted[patternCode] = submitted
  },
})

/** Deletes the confirmed record when the pattern explicitly clears its answers. */
export const clearAnswers = effect('ClearAnswers', {
  factory: ({ answerStore }: PatternDependencies) => async (context: PatternEffectContext, patternCode: string) => {
    await answerStore.delete(patternCode)
    Object.keys(context.getAllAnswers()).forEach(key => context.clearAnswer(key))
  },
})

/** Clears draft answers for this pattern (used after committing drafts to the store). */
export const clearDraftAnswers = effect('ClearDraftAnswers', {
  factory: () => (context: PatternEffectContext, patternCode: string) => {
    const session = context.getSession()

    if (session?.patternDrafts) {
      delete session.patternDrafts[patternCode]
    }

    Object.keys(context.getAllAnswers()).forEach(key => context.clearAnswer(key))
  },
})
