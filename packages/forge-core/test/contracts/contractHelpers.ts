import { govukComponents } from '@ministryofjustice/hmpps-forge/govuk-components'
import { createForgePackage, journey, defineEffectFunctions, type EffectFunctionExpr } from '../../src/authoring'
import { ForgeTestHarness, type RequestTraceEvent } from '../../src/testing'
import type { ForgeRenderer } from '../../src/framework/types/rendering.type'
import type { ComponentRegistryEntry } from '../../src/components/types/components.type'
import type { BlockDefinition } from '../../src/components'
import type {
  RuntimeContextSnapshotTrace,
  RequestTraceUnit,
} from '../../src/engine/chassis/contracts/runtime/trace.type'

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
    .registerPackage(createForgePackage({ journey: journeyDef, functions: effectImplementations }))
    .createClient()
}

export function createTracedClient(journeyDef: ReturnType<typeof journey>, traces: RequestTraceEvent[]) {
  return new ForgeTestHarness({
      instrumentation: {
        sinks: [
          {
            onRequestTrace: event => traces.push(event),
          },
        ],
      },
    })
      .registerGlobalComponents(govukComponents)
      .registerPackage(createForgePackage({ journey: journeyDef, functions: effectImplementations }))
      .createClient()
}

export function createRenderClient(
  journeyDef: ReturnType<typeof journey>,
  renderer: ForgeRenderer<unknown>,
  components: ComponentRegistryEntry<BlockDefinition, unknown>[],
) {
  return new ForgeTestHarness()
    .registerGlobalComponents(components)
    .registerPackage(createForgePackage({ journey: journeyDef, functions: effectImplementations }))
    .createClient(renderer)
}

export function createTracedRenderClient(
  journeyDef: ReturnType<typeof journey>,
  renderer: ForgeRenderer<unknown>,
  traces: RequestTraceEvent[],
  components: ComponentRegistryEntry<BlockDefinition, unknown>[],
) {
  return new ForgeTestHarness({
      instrumentation: {
        sinks: [
          {
            onRequestTrace: event => traces.push(event),
          },
        ],
      },
    })
      .registerGlobalComponents(components)
      .registerPackage(createForgePackage({ journey: journeyDef, functions: effectImplementations }))
      .createClient(renderer)
}

export function answersFromTrace(event: RequestTraceEvent): Record<string, unknown> {
  const snapshots = event.trace.phases
    .flatMap(phase => phase.units)
    .filter(isContextSnapshotTrace)

  const lastSnapshot = snapshots[snapshots.length - 1]

  if (!lastSnapshot || lastSnapshot.kind !== 'context-snapshot') {
    const answerSnapshots = event.trace.phases
      .flatMap(phase => phase.units)
      .map(unit => unit.completeFields.answers)
      .filter(isRecord)

    const lastAnswerSnapshot = answerSnapshots[answerSnapshots.length - 1]

    if (lastAnswerSnapshot !== undefined) {
      return lastAnswerSnapshot
    }

    throw new Error('No context snapshot found in trace')
  }

  return lastSnapshot.answers
}

function isContextSnapshotTrace(unit: RequestTraceUnit): unit is RuntimeContextSnapshotTrace {
  return unit.kind === 'context-snapshot'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
}
