import {
  ConditionRegistry,
  createForgePackage,
  EffectRegistry,
  GeneratorRegistry,
  journey,
  TransformerRegistry,
} from '../../src/authoring'
import { ForgeTestHarness, type ForgeTestHarnessOptions, type RequestTraceEvent } from '../../src/testing'
import type { ForgeRenderer } from '../../src/framework/types/rendering.type'
import type { ComponentRegistryEntry } from '../../src/components/types/components.type'
import type { BlockDefinition } from '../../src/components'
import type {
  RuntimeContextSnapshotTrace,
  RequestTraceUnit,
} from '../../src/engine/chassis/contracts/runtime/trace.type'
import { contractComponents } from './testComponents'

export const ContractConditions = new ConditionRegistry()
export const ContractTransformers = new TransformerRegistry()
export const ContractGenerators = new GeneratorRegistry()
export const ContractEffects = new EffectRegistry()

export const contractFunctionRegistries = [
  ContractConditions,
  ContractTransformers,
  ContractGenerators,
  ContractEffects,
]

export interface ContractSession {
  answers?: Record<string, Record<string, unknown>>
  data?: Record<string, unknown>
}

export const Effects = {
  LoadAnswers: ContractEffects.register('LoadAnswers', {
    factory: () => (context, journeyCode: string) => {
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
  }),

  LoadData: ContractEffects.register('LoadData', {
    factory: () => context => {
      const session = context.getSession() as ContractSession

      if (!session?.data) {
        return
      }

      for (const [key, value] of Object.entries(session.data)) {
        context.setData(key, value)
      }
    },
  }),

  SaveAnswers: ContractEffects.register('SaveAnswers', {
    factory: () => (context, journeyCode: string) => {
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
  }),
}

export interface AnswerHistory {
  current: unknown
  parsed?: unknown
  mutations: { value: unknown; source: string }[]
}

export function answerOf(answers: Record<string, unknown>, code: string): AnswerHistory {
  return answers[code] as AnswerHistory
}

export function createClient(journeyDef: ReturnType<typeof journey>, options?: ForgeTestHarnessOptions) {
  return new ForgeTestHarness(options)
    .registerPackage(
      createForgePackage({
        journey: journeyDef,
        functions: contractFunctionRegistries,
        components: contractComponents,
      }),
    )
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
      .registerPackage(
        createForgePackage({
          journey: journeyDef,
          functions: contractFunctionRegistries,
          components: contractComponents,
        }),
      )
      .createClient()
}

export function createRenderClient(
  journeyDef: ReturnType<typeof journey>,
  renderer: ForgeRenderer<unknown>,
  components: ComponentRegistryEntry<BlockDefinition, unknown>[],
) {
  return new ForgeTestHarness()
    .registerPackage(
      createForgePackage({
        journey: journeyDef,
        functions: contractFunctionRegistries,
        components: [...contractComponents, ...components],
      }),
    )
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
      .registerPackage(
        createForgePackage({
          journey: journeyDef,
          functions: contractFunctionRegistries,
          components: [...contractComponents, ...components],
        }),
      )
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
