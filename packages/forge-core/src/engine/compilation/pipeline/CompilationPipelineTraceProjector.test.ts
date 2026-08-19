import CompilationPipelineTraceProjector from './CompilationPipelineTraceProjector'
import TraceSpan from '../../tracing/TraceSpan'
import type { CompilationTraceEvent } from '../../contracts/compilation/trace.type'
import type { ForgeInstrumentation } from '../../tracing/ForgeTraceSinkDispatcher'

describe('CompilationPipelineTraceProjector', () => {
  describe('emit()', () => {
    it('should strip the compilation prefix from phase names when emitting', () => {
      // Arrange
      const projector = new CompilationPipelineTraceProjector()
      const instrumentation = createInstrumentation()
      const root = rootWithPhase('dsl-validation')

      // Act
      projector.emit({ instrumentation, root, journeyCode: undefined, outcome: 'compiled' })

      // Assert
      const event = emittedEvent(instrumentation)
      expect(event.trace.phases[0].phase).toBe('dsl-validation')
    })

    it('should carry phase timing and serialized units when emitting', () => {
      // Arrange
      const projector = new CompilationPipelineTraceProjector()
      const instrumentation = createInstrumentation()
      const root = rootWithPhase('code-generation')

      // Act
      projector.emit({ instrumentation, root, journeyCode: undefined, outcome: 'compiled' })

      // Assert
      const phase = emittedEvent(instrumentation).trace.phases[0]
      expect(typeof phase.startedAtMs).toBe('number')
      expect(typeof phase.durationMs).toBe('number')
      expect(phase.units[0].key).toBe('unit-a')
      expect(phase.units[0]).toHaveProperty('selfDurationMs')
    })

    it('should pass the outcome and journey code through when emitting', () => {
      // Arrange
      const projector = new CompilationPipelineTraceProjector()
      const instrumentation = createInstrumentation()
      const root = rootWithPhase('code-generation')

      // Act
      projector.emit({ instrumentation, root, journeyCode: 'my-journey', outcome: 'compiled' })

      // Assert
      const event = emittedEvent(instrumentation)
      expect(event.trace.outcome).toBe('compiled')
      expect(event.journeyCode).toBe('my-journey')
    })

    it('should complete an incomplete root span when emitting', () => {
      // Arrange
      const projector = new CompilationPipelineTraceProjector()
      const instrumentation = createInstrumentation()
      const root = rootWithPhase('code-generation')

      // Act
      projector.emit({ instrumentation, root, journeyCode: undefined, outcome: 'compiled' })

      // Assert
      expect(root.completed).toBe(true)
    })

    it('should build an error payload from an Error when the outcome is error', () => {
      // Arrange
      const projector = new CompilationPipelineTraceProjector()
      const instrumentation = createInstrumentation()
      const root = rootWithPhase('dsl-validation')

      // Act
      projector.emit({ instrumentation, root, journeyCode: undefined, outcome: 'error', error: new Error('boom') })

      // Assert
      const error = emittedEvent(instrumentation).trace.error
      expect(error?.message).toBe('boom')
      expect(error?.stack).toContain('boom')
    })

    it('should build an error payload from a non-Error when the outcome is error', () => {
      // Arrange
      const projector = new CompilationPipelineTraceProjector()
      const instrumentation = createInstrumentation()
      const root = rootWithPhase('dsl-validation')

      // Act
      projector.emit({ instrumentation, root, journeyCode: undefined, outcome: 'error', error: 'plain failure' })

      // Assert
      const error = emittedEvent(instrumentation).trace.error
      expect(error).toEqual({ message: 'plain failure' })
    })

    it('should omit the error key when the outcome is compiled', () => {
      // Arrange
      const projector = new CompilationPipelineTraceProjector()
      const instrumentation = createInstrumentation()
      const root = rootWithPhase('code-generation')

      // Act
      projector.emit({ instrumentation, root, journeyCode: undefined, outcome: 'compiled' })

      // Assert
      expect(emittedEvent(instrumentation).trace).not.toHaveProperty('error')
    })

    it('should not emit when instrumentation is disabled', () => {
      // Arrange
      const projector = new CompilationPipelineTraceProjector()
      const instrumentation = createInstrumentation({ enabled: false })
      const root = rootWithPhase('code-generation')

      // Act
      projector.emit({ instrumentation, root, journeyCode: undefined, outcome: 'compiled' })

      // Assert
      expect(instrumentation.onCompilationTrace).not.toHaveBeenCalled()
    })

    it('should not emit when there is no root span', () => {
      // Arrange
      const projector = new CompilationPipelineTraceProjector()
      const instrumentation = createInstrumentation()

      // Act
      projector.emit({ instrumentation, root: undefined, journeyCode: undefined, outcome: 'compiled' })

      // Assert
      expect(instrumentation.onCompilationTrace).not.toHaveBeenCalled()
    })

    it('should not emit when the root span recorded no phases', () => {
      // Arrange
      const projector = new CompilationPipelineTraceProjector()
      const instrumentation = createInstrumentation()
      const root = new TraceSpan('compilation', 'compilation.pipeline')

      // Act
      projector.emit({ instrumentation, root, journeyCode: undefined, outcome: 'compiled' })

      // Assert
      expect(instrumentation.onCompilationTrace).not.toHaveBeenCalled()
    })
  })
})

function createInstrumentation(overrides: Partial<ForgeInstrumentation> = {}): ForgeInstrumentation {
  const instrumentation: ForgeInstrumentation = {
    enabled: true,
    forRequest: () => instrumentation,
    onRequestTrace: vi.fn(),
    onCompilationTrace: vi.fn(),
    ...overrides,
  }

  return instrumentation
}

function rootWithPhase(phaseKind: string): TraceSpan {
  const root = new TraceSpan('compilation', 'compilation.pipeline')
  const phase = new TraceSpan('phase', `compilation.${phaseKind}`, root)
  const unit = new TraceSpan('unit-a', 'compilation.unit', phase)

  root.addChild(phase)
  phase.addChild(unit)
  unit.complete(undefined)
  phase.complete(undefined)

  return root
}

function emittedEvent(instrumentation: ForgeInstrumentation): CompilationTraceEvent {
  const onCompilationTrace = instrumentation.onCompilationTrace as ReturnType<typeof vi.fn>

  return onCompilationTrace.mock.calls[0][0]
}
