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

type PlanGoal = {
  title: string
  status: 'ACTIVE' | 'FUTURE'
  actions: string[]
}

const planGoals: PlanGoal[] = [
  {
    title: 'Improve English skills',
    status: 'ACTIVE',
    actions: ['Attend weekly literacy class', 'Complete practice exercises'],
  },
  { title: 'Find stable housing', status: 'ACTIVE', actions: [] },
  { title: 'Build employment skills', status: 'ACTIVE', actions: [] },
  { title: 'Develop support network', status: 'FUTURE', actions: [] },
]

/** Seeds a draft plan to stand in for the record an API would supply. */
export const loadPlanGoals = effect({
  name: 'LoadPlanGoals',
  factory: () => (context: PatternEffectContext) => {
    const goals = context.getAnswer<PlanGoal[]>('goals') ?? structuredClone(planGoals)

    context.setAnswer('goals', goals)
    context.setData('goals', goals)
  },
})

/** Restores indexed inputs from the active goals before editing them. */
export const initializePlanActions = effect({
  name: 'InitializePlanActions',
  factory: () => (context: PatternEffectContext) => {
    const goals = context.getData<PlanGoal[]>('goals') ?? []
    const activeGoals = goals.filter(goal => goal.status === 'ACTIVE')

    context.setData('activeGoals', activeGoals)
    activeGoals.forEach((goal, index) => {
      if (!context.hasAnswer(`action_${index}`)) {
        context.setAnswer(`action_${index}`, goal.actions.join(', '))
      }
    })
  },
})

/** Moves editable action fields back into the plan before saving the draft. */
export const savePlanActions = effect({
  name: 'SavePlanActions',
  factory: () => (context: PatternEffectContext) => {
    const goals = context.getData<PlanGoal[]>('goals') ?? []
    const activeGoals = goals.filter(goal => goal.status === 'ACTIVE')
    const updated = goals.map(goal => {
      if (goal.status !== 'ACTIVE') {
        return goal
      }

      const index = activeGoals.indexOf(goal)
      const action = context.getAnswer<string>(`action_${index}`)

      context.clearAnswer(`action_${index}`)

      if (typeof action !== 'string' || !action.trim()) {
        return goal
      }

      const actions = action.split(',').map(value => value.trim()).filter(Boolean)

      return { ...goal, actions }
    })

    context.setAnswer('goals', updated)
    context.setData('goals', updated)
  },
})
