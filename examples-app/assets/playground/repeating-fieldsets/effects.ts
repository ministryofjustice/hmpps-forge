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

    // Indexed inputs are temporary form fields; the record owns the collection.
    const answers = { members: context.getAnswer('members') }

    await answerStore.save(answers)
    context.setData('savedAnswers', answers)
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

// Adding and removing members also preserves inputs that have not passed validation.
type HouseholdMember = {
  memberName: unknown
  memberAge: unknown
}

/** Restores household members and indexed inputs before the repeated fields are evaluated. */
export const loadHouseholdMembers = effect({
  name: 'LoadHouseholdMembers',
  factory: () => (context: PatternEffectContext) => {
    const members = context.getAnswer<HouseholdMember[]>('members') ?? []

    restoreHouseholdFields(context, members)
  },
})

/** Preserves the current inputs while adding an empty group without validation. */
export const addHouseholdMember = effect({
  name: 'AddHouseholdMember',
  factory: () => (context: PatternEffectContext) => {
    const members = readHouseholdFields(context)
    const updatedMembers = [...members, { memberName: '', memberAge: '' }]

    persistHouseholdMembers(context, updatedMembers)
  },
})

/** Re-indexes the remaining inputs so removing a member preserves their neighbours. */
export const removeHouseholdMember = effect({
  name: 'RemoveHouseholdMember',
  factory: () => (context: PatternEffectContext) => {
    const members = readHouseholdFields(context)
    const index = Number(context.getPostData<string>('action')?.replace('remove_', ''))

    if (!Number.isInteger(index) || index < 0 || index >= members.length) {
      return
    }

    const updatedMembers = members.filter((_member, position) => position !== index)

    persistHouseholdMembers(context, updatedMembers)
  },
})

/** Keeps the validated members as the draft instead of separate indexed answers. */
export const saveHouseholdMembers = effect({
  name: 'SaveHouseholdMembers',
  factory: () => (context: PatternEffectContext) => {
    const members = readHouseholdFields(context)

    persistHouseholdMembers(context, members)
  },
})

function readHouseholdFields(context: PatternEffectContext) {
  const members = context.getData<HouseholdMember[]>('members') ?? []

  return members.map((member, index) => ({
    memberName: context.getAnswer(`memberName_${index}`) ?? member.memberName,
    memberAge: context.getAnswer(`memberAge_${index}`) ?? member.memberAge,
  }))
}

function restoreHouseholdFields(context: PatternEffectContext, members: HouseholdMember[]) {
  Object.keys(context.getAllAnswers())
    .filter(code => code.startsWith('memberName_') || code.startsWith('memberAge_'))
    .forEach(code => context.clearAnswer(code))
  context.setData('members', members)
  members.forEach((member, index) => {
    context.setAnswer(`memberName_${index}`, member.memberName ?? '')
    context.setAnswer(`memberAge_${index}`, member.memberAge ?? '')
  })
}

function persistHouseholdMembers(context: PatternEffectContext, members: HouseholdMember[]) {
  const session = context.getSession()

  if (!session) {
    return
  }

  session.draftAnswers = { members }
  context.setAnswer('members', members)
  restoreHouseholdFields(context, members)
}
