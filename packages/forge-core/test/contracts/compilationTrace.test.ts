import { describe, expect, it } from 'vitest'
import { GovUKButton, GovUKTextInput, govukComponents } from '@ministryofjustice/hmpps-forge/govuk-components'
import { createForgePackage, field, journey, step } from '../../src/authoring'
import Forge from '../../src/engine/Forge'
import type { JourneyDefinition } from '../../src/authoring/types/structures.type'
import type { FieldBlockDefinition } from '../../src/components/types/structures.type'
import type { CompilationTraceEvent } from '../../src/engine/contracts/compilation/trace.type'

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

})
