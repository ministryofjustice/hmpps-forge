import CompilationTracer from './CompilationTracer'
import type TraceSpan from '../../tracing/TraceSpan'

describe('CompilationTracer', () => {
  describe('span()', () => {
    it('should nest a span inside its parent span when spans are enabled', () => {
      // Arrange
      const tracer = new CompilationTracer({ enabled: true })
      let innerSpan: TraceSpan | undefined

      // Act
      tracer.span('outer', 'compilation.a', () => {
        tracer.span('inner', 'compilation.b', span => {
          innerSpan = span
        })
      })

      // Assert
      const outerSpan = tracer.root?.children[0]
      expect(outerSpan?.key).toBe('outer')
      expect(outerSpan?.children[0].key).toBe('inner')
      expect(innerSpan?.parent).toBe(outerSpan)
    })

    it('should return the result of run when spans are enabled', () => {
      // Arrange
      const tracer = new CompilationTracer({ enabled: true })

      // Act
      const result = tracer.span('outer', 'compilation.a', () => 42)

      // Assert
      expect(result).toBe(42)
    })

    it('should pass undefined to run when the tracer is disabled', () => {
      // Arrange
      const tracer = new CompilationTracer()
      let received: TraceSpan | undefined = {} as TraceSpan

      // Act
      const result = tracer.span('outer', 'compilation.a', span => {
        received = span

        return 'value'
      })

      // Assert
      expect(received).toBeUndefined()
      expect(result).toBe('value')
    })

    it('should reuse the shared disabled tracer without recording spans', () => {
      // Arrange
      const tracer = CompilationTracer.disabled

      // Act
      const result = tracer.span('outer', 'compilation.a', span => span)

      // Assert
      expect(result).toBeUndefined()
      expect(tracer.enabled).toBe(false)
      expect(tracer.root).toBeUndefined()
    })

    it('should leave a thrown span incomplete and parent later spans to the root', () => {
      // Arrange
      const tracer = new CompilationTracer({ enabled: true })

      // Act
      expect(() =>
        tracer.span('failing', 'compilation.a', () => {
          throw new Error('boom')
        }),
      ).toThrow('boom')
      tracer.span('after', 'compilation.b', () => undefined)

      // Assert
      const [failingSpan, afterSpan] = tracer.root?.children ?? []
      expect(failingSpan.completed).toBe(false)
      expect(afterSpan.completed).toBe(true)
      expect(afterSpan.parent).toBe(tracer.root)
    })

    it('should record self time as duration minus direct children when spans nest', () => {
      // Arrange
      const tracer = new CompilationTracer({ enabled: true })

      // Act
      tracer.span('outer', 'compilation.a', () => {
        tracer.span('inner', 'compilation.b', () => undefined)
      })

      // Assert
      const outerSpan = tracer.root?.children[0]
      expect(outerSpan?.selfDurationMs).toBeGreaterThanOrEqual(0)
      expect(outerSpan?.selfDurationMs).toBeLessThanOrEqual(outerSpan?.durationMs ?? 0)
    })
  })

  describe('recordJourneyCode()', () => {
    it('should expose the recorded code when the tracer is enabled', () => {
      // Arrange
      const tracer = new CompilationTracer({ enabled: true })

      // Act
      tracer.recordJourneyCode('my-journey')

      // Assert
      expect(tracer.journeyCode).toBe('my-journey')
    })

    it('should ignore the recorded code when the tracer is disabled', () => {
      // Arrange
      const tracer = new CompilationTracer()

      // Act
      tracer.recordJourneyCode('my-journey')

      // Assert
      expect(tracer.journeyCode).toBeUndefined()
    })
  })

  describe('captureGeneratedSource', () => {
    it('should be false by default when enabled', () => {
      // Arrange
      const tracer = new CompilationTracer({ enabled: true })

      // Act
      const captureGeneratedSource = tracer.captureGeneratedSource

      // Assert
      expect(captureGeneratedSource).toBe(false)
    })

    it('should be false when the option is set but the tracer is disabled', () => {
      // Arrange
      const tracer = new CompilationTracer({ enabled: false, captureGeneratedSource: true })

      // Act
      const captureGeneratedSource = tracer.captureGeneratedSource

      // Assert
      expect(captureGeneratedSource).toBe(false)
    })

    it('should be true when enabled and the option is set', () => {
      // Arrange
      const tracer = new CompilationTracer({ enabled: true, captureGeneratedSource: true })

      // Act
      const captureGeneratedSource = tracer.captureGeneratedSource

      // Assert
      expect(captureGeneratedSource).toBe(true)
    })
  })
})
