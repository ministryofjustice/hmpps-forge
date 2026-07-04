import CompilationTraceProjector from './CompilationTraceProjector'
import CompilationTracer from './CompilationTracer'
import type { CompilationTraceEvent } from './compilationTrace.type'
import type { ForgeInstrumentation } from '../ForgeTraceSinkDispatcher'

describe('CompilationTraceProjector', () => {
  describe('emit()', () => {
    it('should strip the compilation prefix from phase names when emitting', () => {
      // Arrange
      const projector = new CompilationTraceProjector()
      const instrumentation = createInstrumentation()
      const tracer = tracerWithPhase('dsl-validation')

      // Act
      projector.emit(instrumentation, tracer, 'compiled')

      // Assert
      const event = emittedEvent(instrumentation)
      expect(event.trace.phases[0].phase).toBe('dsl-validation')
    })

    it('should carry phase timing and serialized units when emitting', () => {
      // Arrange
      const projector = new CompilationTraceProjector()
      const instrumentation = createInstrumentation()
      const tracer = tracerWithPhase('code-generation')

      // Act
      projector.emit(instrumentation, tracer, 'compiled')

      // Assert
      const phase = emittedEvent(instrumentation).trace.phases[0]
      expect(typeof phase.startedAtMs).toBe('number')
      expect(typeof phase.durationMs).toBe('number')
      expect(phase.units[0].key).toBe('unit-a')
      expect(phase.units[0]).toHaveProperty('selfDurationMs')
    })

    it('should pass the outcome and journey code through when emitting', () => {
      // Arrange
      const projector = new CompilationTraceProjector()
      const instrumentation = createInstrumentation()
      const tracer = tracerWithPhase('code-generation')
      tracer.recordJourneyCode('my-journey')

      // Act
      projector.emit(instrumentation, tracer, 'compiled')

      // Assert
      const event = emittedEvent(instrumentation)
      expect(event.trace.outcome).toBe('compiled')
      expect(event.journeyCode).toBe('my-journey')
    })

    it('should complete the root span when emitting', () => {
      // Arrange
      const projector = new CompilationTraceProjector()
      const instrumentation = createInstrumentation()
      const tracer = tracerWithPhase('code-generation')

      // Act
      projector.emit(instrumentation, tracer, 'compiled')

      // Assert
      expect(tracer.root?.completed).toBe(true)
    })

    it('should build an error payload from an Error when the outcome is error', () => {
      // Arrange
      const projector = new CompilationTraceProjector()
      const instrumentation = createInstrumentation()
      const tracer = tracerWithPhase('dsl-validation')

      // Act
      projector.emit(instrumentation, tracer, 'error', new Error('boom'))

      // Assert
      const error = emittedEvent(instrumentation).trace.error
      expect(error?.message).toBe('boom')
      expect(error?.stack).toContain('boom')
    })

    it('should build an error payload from a non-Error when the outcome is error', () => {
      // Arrange
      const projector = new CompilationTraceProjector()
      const instrumentation = createInstrumentation()
      const tracer = tracerWithPhase('dsl-validation')

      // Act
      projector.emit(instrumentation, tracer, 'error', 'plain failure')

      // Assert
      const error = emittedEvent(instrumentation).trace.error
      expect(error).toEqual({ message: 'plain failure' })
    })

    it('should omit the error key when the outcome is compiled', () => {
      // Arrange
      const projector = new CompilationTraceProjector()
      const instrumentation = createInstrumentation()
      const tracer = tracerWithPhase('code-generation')

      // Act
      projector.emit(instrumentation, tracer, 'compiled')

      // Assert
      expect(emittedEvent(instrumentation).trace).not.toHaveProperty('error')
    })

    it('should not emit when instrumentation is disabled', () => {
      // Arrange
      const projector = new CompilationTraceProjector()
      const instrumentation = createInstrumentation({ enabled: false })
      const tracer = tracerWithPhase('code-generation')

      // Act
      projector.emit(instrumentation, tracer, 'compiled')

      // Assert
      expect(instrumentation.onCompilationTrace).not.toHaveBeenCalled()
    })

    it('should not emit when the tracer recorded no phases', () => {
      // Arrange
      const projector = new CompilationTraceProjector()
      const instrumentation = createInstrumentation()
      const tracer = new CompilationTracer({ enabled: true })

      // Act
      projector.emit(instrumentation, tracer, 'compiled')

      // Assert
      expect(instrumentation.onCompilationTrace).not.toHaveBeenCalled()
    })
  })
})

function createInstrumentation(overrides: Partial<ForgeInstrumentation> = {}): ForgeInstrumentation {
  return {
    enabled: true,
    captureGeneratedSource: false,
    onRequestTrace: vi.fn(),
    onCompilationTrace: vi.fn(),
    ...overrides,
  }
}

function tracerWithPhase(phaseKind: string): CompilationTracer {
  const tracer = new CompilationTracer({ enabled: true })

  tracer.span('phase', `compilation.${phaseKind}`, () => {
    tracer.span('unit-a', 'compilation.unit', () => undefined)
  })

  return tracer
}

function emittedEvent(instrumentation: ForgeInstrumentation): CompilationTraceEvent {
  const onCompilationTrace = instrumentation.onCompilationTrace as ReturnType<typeof vi.fn>

  return onCompilationTrace.mock.calls[0][0]
}
