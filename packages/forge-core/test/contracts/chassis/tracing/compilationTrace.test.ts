import { describe, expect, it } from 'vitest'
import { createForgePackage } from '../../../../src/authoring'
import Forge from '../../../../src/engine/Forge'
import type { JourneyDefinition } from '../../../../src/authoring/types/structures.type'
import type { CompilationTraceEvent } from '../../../../src/engine/chassis/contracts/compilation/trace.type'
import type { SerializedTraceSpan } from '../../../../src/engine/chassis/tracing/traceSpan.type'
import { contractFunctionRegistries } from '../../contractHelpers'
import { contractComponents } from '../../testComponents'
import { failingJourney, nestedStepsJourney, traceJourney } from './compilationTrace.fixtures'

const silentLogger = {
  log: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as Console

function registerAndCollect(
  targetJourney: string | JourneyDefinition,
  strictRegistration: boolean,
): { register: () => void; events: CompilationTraceEvent[] } {
  const events: CompilationTraceEvent[] = []
  const forge = new Forge({
    logger: silentLogger,
    strictRegistration,
    instrumentation: { sinks: [{ onRequestTrace: () => {}, onCompilationTrace: event => events.push(event) }] },
  })

  return {
    register: () =>
      forge.registerPackage(
        createForgePackage({
          journey: targetJourney,
          functions: contractFunctionRegistries,
          components: contractComponents,
        }),
      ),
    events,
  }
}

describe('compilation trace contracts', () => {
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

    it('should record phases in pipeline order with timing when compilation succeeds', () => {
      // Arrange
      const { register, events } = registerAndCollect(traceJourney, true)

      // Act
      register()

      // Assert
      const [event] = events

      expect(event.trace.phases.map(phase => phase.phase)).toEqual([
        'dsl-validation',
        'ast',
        'semantic-analysis',
        'analysis',
        'lowering',
        'routes',
      ])
      expect(event.trace.completedAtMs).toBeDefined()
      expect(event.trace.durationMs).toBeDefined()
      event.trace.phases.forEach(phase => {
        expect(phase.startedAtMs).toBeTypeOf('number')
        expect(phase.completedAtMs).toBeDefined()
        expect(phase.durationMs).toBeDefined()
      })
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

    it('should end the phase list at the incomplete failing phase when semantic analysis rejects the journey', () => {
      // Arrange
      const { register, events } = registerAndCollect(failingJourney, false)

      // Act
      register()

      // Assert
      const [event] = events

      expect(event.trace.phases.map(phase => phase.phase)).toEqual(['dsl-validation', 'ast', 'semantic-analysis'])
      expect(event.trace.phases[0].completedAtMs).toBeDefined()
      expect(event.trace.phases[1].completedAtMs).toBeDefined()
      expect(event.trace.phases[2].completedAtMs).toBeUndefined()
    })

    it('should carry timing on the error trace when compilation fails', () => {
      // Arrange
      const { register, events } = registerAndCollect(failingJourney, false)

      // Act
      register()

      // Assert
      // A failed compilation leaves the root span incomplete; the projector
      // closes it at emission so the error trace still carries a duration.
      const [event] = events

      expect(event.trace.outcome).toBe('error')
      expect(event.trace.startedAtMs).toBeTypeOf('number')
      expect(event.trace.completedAtMs).toBeDefined()
      expect(event.trace.durationMs).toBeDefined()
    })

    it('should register a package normally when no instrumentation sinks are configured', () => {
      // Arrange
      const forge = new Forge({ logger: silentLogger, strictRegistration: true })

      // Act
      const act = () =>
        forge.registerPackage(
          createForgePackage({
            journey: traceJourney,
            functions: contractFunctionRegistries,
            components: contractComponents,
          }),
        )

      // Assert
      expect(act).not.toThrow()
    })

    it('should skip sinks without onCompilationTrace when dispatching compilation traces', () => {
      // Arrange
      const events: CompilationTraceEvent[] = []
      const forge = new Forge({
        logger: silentLogger,
        strictRegistration: true,
        instrumentation: {
          sinks: [
            { onRequestTrace: () => {} },
            { onRequestTrace: () => {}, onCompilationTrace: event => events.push(event) },
          ],
        },
      })

      // Act
      forge.registerPackage(
        createForgePackage({
          journey: traceJourney,
          functions: contractFunctionRegistries,
          components: contractComponents,
        }),
      )

      // Assert
      expect(events).toHaveLength(1)
      expect(events[0].trace.outcome).toBe('compiled')
    })
  })

  describe('unit timing detail', () => {
    it('should record execution slices and self duration on compilation trace units', () => {
      // Arrange
      const { register, events } = registerAndCollect(traceJourney, true)

      // Act
      register()

      // Assert
      const loweringUnits = events[0].trace.phases.find(phase => phase.phase === 'lowering')?.units ?? []

      expect(loweringUnits.length).toBeGreaterThan(0)
      loweringUnits.forEach(unit => {
        expect(unit.selfDurationMs).toBeTypeOf('number')
        expect(unit.executionSlices?.length).toBeGreaterThan(0)
      })
    })
  })

  describe('per-journey codegen coverage', () => {
    it('should nest one codegen.journey unit per journey with a codegen.step child per step when journeys nest', () => {
      // Arrange
      const { register, events } = registerAndCollect(nestedStepsJourney, true)

      // Act
      register()

      // Assert
      const loweringPhase = events[0].trace.phases.find(phase => phase.phase === 'lowering')
      const loweringUnits = loweringPhase?.units ?? []
      const journeyUnits = loweringUnits.filter(unit => unit.kind === 'codegen.journey')
      const stepUnits = journeyUnits.flatMap(unit => unit.children)

      expect(loweringUnits.map(unit => unit.kind)).toContain('codegen.package-functions')
      expect(journeyUnits).toHaveLength(2)
      expect(stepUnits.every(unit => unit.kind === 'codegen.step')).toBe(true)
      expect(journeyUnits.map(unit => unit.children.length).sort()).toEqual([1, 2])
      expect([...journeyUnits, ...stepUnits].every(unit => isNodeIdentifiedUnit(unit))).toBe(true)
    })
  })
})

/** Codegen units identify the journey or step they compiled via `beginFields.nodeId`. */
function isNodeIdentifiedUnit(unit: SerializedTraceSpan): boolean {
  return typeof unit.beginFields.nodeId === 'string'
}
