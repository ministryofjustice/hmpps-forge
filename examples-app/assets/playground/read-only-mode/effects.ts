import { effect } from '@ministryofjustice/hmpps-forge/core/authoring'
import type { EffectFunctionContext } from '@ministryofjustice/hmpps-forge/core/authoring'
import type { AnswerStore } from './AnswerStore'

export type PatternDependencies = { answerStore: Pick<AnswerStore, 'get' | 'getAll' | 'save'> }

type PatternSession = { demoUser?: { name: string; role: string } }
type PatternEffectContext = EffectFunctionContext<Record<string, unknown>, Record<string, unknown>, PatternSession>

/** Simulates identity for exploring role-dependent content in the preview. */
export const simulateLogin = effect({
  name: 'SimulateLogin',
  factory: () => (context: PatternEffectContext, name: string, role: string) => {
    const session = context.getSession()

    if (session) {
      session.demoUser = { name, role }
    }
  },
})

export const simulateLogout = effect({
  name: 'SimulateLogout',
  factory: () => (context: PatternEffectContext) => {
    const session = context.getSession()

    if (session) {
      delete session.demoUser
    }
  },
})

/** Loads saved contacts independently of the simulated login session. */
export const loadContacts = effect({
  name: 'LoadContacts',
  factory: ({ answerStore }: PatternDependencies) => async (context: PatternEffectContext) => {
    context.setAnswer('contacts', await answerStore.getAll())
  },
})

/** Loads the selected saved record into the form or read-only view. */
export const loadContact = effect({
  name: 'LoadContact',
  factory: ({ answerStore }: PatternDependencies) => async (context: PatternEffectContext) => {
    const contact = await answerStore.get(String(context.getRequestParam('index')))

    if (!contact) {
      return
    }

    Object.entries(contact).forEach(([code, value]) => context.setAnswer(code, value))
  },
})

/** Saves an edited contact without putting persisted records in the session. */
export const saveContact = effect({
  name: 'SaveContact',
  factory: ({ answerStore }: PatternDependencies) => async (context: PatternEffectContext) => {
    const recordId = String(context.getRequestParam('index'))
    const recordName = context.getAnswer('recordName')
    const recordEmail = context.getAnswer('recordEmail')
    const recordDepartment = context.getAnswer('recordDepartment')

    if (typeof recordName !== 'string' || typeof recordEmail !== 'string' || typeof recordDepartment !== 'string') {
      return
    }

    await answerStore.save(recordId, { recordName, recordEmail, recordDepartment })
  },
})
