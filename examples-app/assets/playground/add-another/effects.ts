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

/** Appends the completed contact and clears the temporary form fields. */
export const addContact = effect({
  name: 'AddContact',
  factory: () => (context: PatternEffectContext) => {
    const contacts = context.getAnswer<Record<string, unknown>[]>('contacts') ?? []
    const { contactName, contactRelationship, contactPhone } = context.getAllAnswers()
    const contact = { contactName, contactRelationship, contactPhone }

    context.setAnswer('contacts', [...contacts, contact])
    context.setAnswer('contactName', undefined)
    context.setAnswer('contactRelationship', undefined)
    context.setAnswer('contactPhone', undefined)
  },
})

/** Loads the selected contact into the edit form on access. */
export const loadContactForEdit = effect({
  name: 'LoadContactForEdit',
  factory: () => (context: PatternEffectContext) => {
    const contacts = context.getAnswer<Record<string, unknown>[]>('contacts') ?? []
    const index = Number(context.getRequestParam('index'))
    const contact = contacts[index]

    if (!Number.isInteger(index) || !contact) {
      return
    }

    context.setAnswer('contactName', contact.contactName)
    context.setAnswer('contactRelationship', contact.contactRelationship)
    context.setAnswer('contactPhone', contact.contactPhone)
  },
})

/** Replaces the contact selected by the route and clears the temporary fields. */
export const updateContact = effect({
  name: 'UpdateContact',
  factory: () => (context: PatternEffectContext) => {
    const contacts = context.getAnswer<Record<string, unknown>[]>('contacts') ?? []
    const index = Number(context.getRequestParam('index'))

    if (!Number.isInteger(index) || !contacts[index]) {
      return
    }

    const { contactName, contactRelationship, contactPhone } = context.getAllAnswers()
    const contact = { contactName, contactRelationship, contactPhone }

    context.setAnswer('contacts', contacts.map((existingContact, position) => position === index ? contact : existingContact))
    context.setAnswer('contactName', undefined)
    context.setAnswer('contactRelationship', undefined)
    context.setAnswer('contactPhone', undefined)
  },
})

/** Loads the selected contact as display data for the removal confirmation. */
export const loadContactForDelete = effect({
  name: 'LoadContactForDelete',
  factory: () => (context: PatternEffectContext) => {
    const contacts = context.getAnswer<Record<string, unknown>[]>('contacts') ?? []
    const index = Number(context.getRequestParam('index'))
    const contact = contacts[index]

    if (!Number.isInteger(index) || !contact) {
      return
    }

    context.setData('contactName', contact.contactName)
    context.setData('contactRelationship', contact.contactRelationship)
    context.setData('contactPhone', contact.contactPhone)
  },
})

/** Removes the contact selected by the route. */
export const deleteContact = effect({
  name: 'DeleteContact',
  factory: () => (context: PatternEffectContext) => {
    const contacts = context.getAnswer<Record<string, unknown>[]>('contacts') ?? []
    const index = Number(context.getRequestParam('index'))

    if (!Number.isInteger(index) || !contacts[index]) {
      return
    }

    context.setAnswer('contacts', contacts.filter((_contact, position) => position !== index))
  },
})
