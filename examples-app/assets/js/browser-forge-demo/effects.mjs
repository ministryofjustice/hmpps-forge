import { effect } from '@ministryofjustice/hmpps-forge/core/authoring'

/**
 * Session-draft persistence for the client-side demos. The adapter owns the
 * session object and writes it to sessionStorage after every request, so these
 * effects are all the storage the demos need - answers survive reloads with no
 * server anywhere.
 *
 * Drafts are scoped per journey (`session.demoDrafts[journeyCode]`) because
 * every demo journey shares one session. Access hooks cascade root-first from
 * ancestor journeys, so the loaders sit on the journey (or step) that owns the
 * draft, never on the shared parent.
 */

export const LoadDraft = effect('LoadDemoDraft', {
  factory: () => (context, journeyCode) => {
    const draft = context.getSession()?.demoDrafts?.[journeyCode]

    if (!draft) {
      return
    }

    Object.entries(draft).forEach(([code, value]) => {
      if (!context.hasAnswer(code)) {
        context.setAnswer(code, value)
      }
    })
  },
})

export const SaveDraft = effect('SaveDemoDraft', {
  factory: () => (context, journeyCode) => {
    const session = context.getSession()

    if (!session) {
      return
    }

    session.demoDrafts = session.demoDrafts ?? {}
    session.demoDrafts[journeyCode] = { ...session.demoDrafts[journeyCode], ...context.getAllAnswers() }
  },
})

export const ClearDraft = effect('ClearDemoDraft', {
  factory: () => (context, journeyCode) => {
    const session = context.getSession()

    if (session?.demoDrafts) {
      delete session.demoDrafts[journeyCode]
    }
  },
})

/** Bundles the named field answers into an object, appends it to the collection, and clears the fields. */
export const AddItemToCollection = effect('AddItemToCollection', {
  factory: () => (context, collectionCode, fieldCodes) => {
    const item = {}

    fieldCodes.forEach(code => {
      const value = context.getAnswer(code)

      if (value !== undefined) {
        item[code] = value
      }
    })

    const collection = context.getAnswer(collectionCode) ?? []

    context.setAnswer(collectionCode, [...collection, item])
    fieldCodes.forEach(code => context.setAnswer(code, undefined))
  },
})

/** Reads the ':index' route parameter and removes the item at that position from the collection. */
export const DeleteItemFromCollection = effect('DeleteItemFromCollection', {
  factory: () => (context, collectionCode) => {
    const index = parseInt(context.getRequestParam('index') ?? '', 10)
    const collection = context.getAnswer(collectionCode) ?? []

    if (Number.isNaN(index) || index < 0 || index >= collection.length) {
      return
    }

    const updated = [...collection]

    updated.splice(index, 1)
    context.setAnswer(collectionCode, updated)
  },
})

/** Pre-fills the fields from the item at the ':index' route parameter and remembers the index for the save. */
export const LoadItemForEdit = effect('LoadItemForEdit', {
  factory: () => (context, journeyCode, collectionCode, fieldCodes) => {
    const index = parseInt(context.getRequestParam('index') ?? '', 10)
    const collection = context.getAnswer(collectionCode) ?? []

    if (Number.isNaN(index) || index < 0 || index >= collection.length) {
      return
    }

    const item = collection[index]

    // Unconditional set: the draft can hold a cleared value for these field
    // codes, so the item being edited must win over anything already loaded.
    fieldCodes.forEach(code => {
      if (item[code] !== undefined) {
        context.setAnswer(code, item[code])
      }
    })

    const session = context.getSession()

    if (session) {
      session.demoEditing = { ...session.demoEditing, [journeyCode]: index }
    }
  },
})

/** Replaces the remembered item with the current field answers, then clears the fields. */
export const EditItemInCollection = effect('EditItemInCollection', {
  factory: () => (context, journeyCode, collectionCode, fieldCodes) => {
    const session = context.getSession()
    const index = session?.demoEditing?.[journeyCode]
    const collection = context.getAnswer(collectionCode) ?? []

    if (index === undefined || index < 0 || index >= collection.length) {
      return
    }

    const item = {}

    fieldCodes.forEach(code => {
      const value = context.getAnswer(code)

      if (value !== undefined) {
        item[code] = value
      }
    })

    const updated = [...collection]

    updated[index] = item
    context.setAnswer(collectionCode, updated)
    fieldCodes.forEach(code => context.setAnswer(code, undefined))
    delete session.demoEditing[journeyCode]
  },
})
