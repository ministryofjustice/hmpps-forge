import { govukComponents } from '@ministryofjustice/hmpps-forge/govuk-components'
import { journey, defineEffectFunctions, type EffectFunctionExpr } from '../authoring'
import { ForgeTestHarness, type RequestTraceEvent } from '../testing'

export interface ContractEffectShape {
  LoadAnswers: (journeyCode: string) => EffectFunctionExpr
  SaveAnswers: (journeyCode: string) => EffectFunctionExpr
  LoadData: () => EffectFunctionExpr
}

export interface ContractSession {
  answers?: Record<string, Record<string, unknown>>
  data?: Record<string, unknown>
}

export const { effects: Effects, implementations: effectImplementations } = defineEffectFunctions<ContractEffectShape>({
  LoadAnswers: () => (context, journeyCode: string) => {
    const stored = (context.getSession() as ContractSession)?.answers?.[journeyCode]

    if (!stored) {
      return
    }

    for (const [code, value] of Object.entries(stored)) {
      if (!context.hasAnswer(code)) {
        context.setAnswer(code, value)
      }
    }
  },

  LoadData: () => context => {
    const session = context.getSession() as ContractSession

    if (!session?.data) {
      return
    }

    for (const [key, value] of Object.entries(session.data)) {
      context.setData(key, value)
    }
  },

  SaveAnswers: () => (context, journeyCode: string) => {
    const session = context.getSession() as ContractSession

    if (!session) {
      return
    }

    if (!session.answers) {
      session.answers = {}
    }

    session.answers[journeyCode] = {
      ...session.answers[journeyCode],
      ...context.getAllAnswers(),
    }
  },
})

export interface AnswerHistory {
  current: unknown
  parsed?: unknown
  mutations: { value: unknown; source: string }[]
}

export function answerOf(answers: Record<string, unknown>, code: string): AnswerHistory {
  return answers[code] as AnswerHistory
}

export function createClient(journeyDef: ReturnType<typeof journey>) {
  return new ForgeTestHarness()
    .registerGlobalComponents(govukComponents)
    .registerPackage({ journey: journeyDef, functions: effectImplementations })
    .createClient()
}

export function createTracedClient(journeyDef: ReturnType<typeof journey>, traces: RequestTraceEvent[]) {
  return new ForgeTestHarness()
    .registerGlobalComponents(govukComponents)
    .registerPackage({ journey: journeyDef, functions: effectImplementations })
    .createClient({
      traceObserver: {
        shouldTrace: () => true,
        onTrace: event => traces.push(event),
      },
    })
}

export function answersFromTrace(event: RequestTraceEvent): Record<string, unknown> {
  const snapshots = event.trace.phases
    .flatMap(phase => phase.units)
    .filter(unit => unit.kind === 'context-snapshot')

  const lastSnapshot = snapshots[snapshots.length - 1]

  if (!lastSnapshot || lastSnapshot.kind !== 'context-snapshot') {
    throw new Error('No context snapshot found in trace')
  }

  return lastSnapshot.answers
}
