import { describe, expect, it } from 'vitest'
import { GovUKButton, GovUKTextInput, govukComponents } from '@ministryofjustice/hmpps-forge/govuk-components'
import { createForgePackage, field, journey, step } from '../../src/authoring'
import { ForgeTestHarness } from '../../src/testing'
import Forge from '../../src/engine/Forge'
import type { JourneyDefinition } from '../../src/authoring/types/structures.type'
import type { FieldBlockDefinition } from '../../src/components/types/structures.type'
import type { CompilationTraceEvent } from '../../src/engine/compilation/tracing/compilationTrace.type'
import type { SerializedTraceSpan } from '../../src/engine/tracing/traceSpan.type'

const silentLogger = {
  log: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as Console

const traceJourney = journey({
  code: 'compilation-trace',
  path: '/compilation-trace',
  title: 'Compilation Trace',
  steps: [
    step({
      path: '/name',
      title: 'Name',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'name', label: 'Name' }), GovUKButton({ text: 'Continue' })],
    }),
  ],
})

const failingJourney = journey({
  code: 'failing-trace',
  path: '/failing-trace',
  title: 'Failing Trace',
  steps: [
    step({
      path: '/name',
      title: 'Name',
      reachability: { entryWhen: true },
      blocks: [field<FieldBlockDefinition & { variant: string }>({ code: 'fullName', variant: 'UnregisteredInput' })],
    }),
  ],
})

function collectTrace(captureGeneratedSource: boolean): CompilationTraceEvent {
  const events: CompilationTraceEvent[] = []

  new ForgeTestHarness({
    instrumentation: {
      sinks: [{ onRequestTrace: () => {}, onCompilationTrace: event => events.push(event) }],
      captureGeneratedSource,
    },
  })
    .registerGlobalComponents(govukComponents)
    .registerPackage(createForgePackage({ journey: traceJourney }))

  return events[0]
}

function registerAndCollect(
  targetJourney: string | JourneyDefinition,
  strictRegistration: boolean,
): { register: () => void; events: CompilationTraceEvent[] } {
  const events: CompilationTraceEvent[] = []
  const forge = new Forge({
    logger: silentLogger,
    strictRegistration,
    instrumentation: { sinks: [{ onRequestTrace: () => {}, onCompilationTrace: event => events.push(event) }] },
  }).registerGlobalComponents(govukComponents)

  return { register: () => forge.registerPackage(createForgePackage({ journey: targetJourney })), events }
}

function someUnit(units: readonly SerializedTraceSpan[], predicate: (unit: SerializedTraceSpan) => boolean): boolean {
  return units.some(unit => predicate(unit) || someUnit(unit.children, predicate))
}

describe('Forge compilation tracing', () => {
  describe('registerPackage() events', () => {
    it('should emit a compiled trace with dsl-validation and every pipeline phase', () => {
      // Arrange
      const { register, events } = registerAndCollect(traceJourney, true)

      // Act
      register()

      // Assert
      const [event] = events

      expect(events).toHaveLength(1)
      expect(event.journeyCode).toBe('compilation-trace')
      expect(event.trace.outcome).toBe('compiled')
      expect(event.trace.phases.map(phase => phase.phase)).toEqual(
        expect.arrayContaining(['dsl-validation', 'ast', 'semantic-analysis', 'analysis', 'lowering', 'routes']),
      )
      expect(event.trace.phases).toHaveLength(6)
    })

    it('should emit an error trace when registration fails without strict mode', () => {
      // Arrange
      const { register, events } = registerAndCollect(failingJourney, false)

      // Act
      register()

      // Assert
      const [event] = events

      expect(events).toHaveLength(1)
      expect(event.trace.outcome).toBe('error')
      expect(event.trace.error?.message).toBeTruthy()
    })

    it('should emit an error trace even when strict registration rethrows', () => {
      // Arrange
      const { register, events } = registerAndCollect(failingJourney, true)

      // Act & Assert
      expect(register).toThrow()
      expect(events).toHaveLength(1)
      expect(events[0].trace.outcome).toBe('error')
    })

    it('should emit an error trace with an incomplete dsl-validation phase when schema validation fails', () => {
      // Arrange
      const { register, events } = registerAndCollect('{}', false)

      // Act
      register()

      // Assert
      const [event] = events

      expect(events).toHaveLength(1)
      expect(event.trace.outcome).toBe('error')
      expect(event.trace.phases.map(phase => phase.phase)).toEqual(['dsl-validation'])
      expect(event.trace.phases[0].completedAtMs).toBeUndefined()
    })
  })

  describe('captureGeneratedSource', () => {
    it('should attach wrapped generated source to a lowering codegen span when capture is enabled', () => {
      // Arrange
      const event = collectTrace(true)

      // Act
      const loweringPhase = event.trace.phases.find(phase => phase.phase === 'lowering')
      const hasCapturedSource = someUnit(loweringPhase?.units ?? [], unit => {
        const source = unit.beginFields.source

        return typeof source === 'string' && source.includes('use strict')
      })

      // Assert
      expect(loweringPhase).toBeDefined()
      expect(hasCapturedSource).toBe(true)
    })

    it('should not attach any source to trace spans when capture is disabled', () => {
      // Arrange
      const event = collectTrace(false)

      // Act
      const anyPhaseHasSource = event.trace.phases.some(phase =>
        someUnit(phase.units, unit => 'source' in unit.beginFields),
      )

      // Assert
      expect(anyPhaseHasSource).toBe(false)
    })
  })
})
