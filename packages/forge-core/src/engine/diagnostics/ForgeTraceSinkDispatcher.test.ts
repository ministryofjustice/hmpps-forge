import type { RequestTraceEvent } from '../contracts/runtime/trace.type'
import type { CompilationTraceEvent } from './tracing/compilationTrace.type'
import ForgeTraceSinkDispatcher from './ForgeTraceSinkDispatcher'

describe('ForgeTraceSinkDispatcher', () => {
  describe('enabled', () => {
    it('should be false when no sinks are configured', () => {
      // Arrange
      const instrumentation = new ForgeTraceSinkDispatcher()

      // Act
      const enabled = instrumentation.enabled

      // Assert
      expect(enabled).toBe(false)
    })

    it('should be true when sinks are configured', () => {
      // Arrange
      const instrumentation = new ForgeTraceSinkDispatcher({
        sinks: [{ onRequestTrace: vi.fn() }],
      })

      // Act
      const enabled = instrumentation.enabled

      // Assert
      expect(enabled).toBe(true)
    })

    it('should accept the captureGeneratedSource option', () => {
      // Arrange
      const instrumentation = new ForgeTraceSinkDispatcher({
        sinks: [{ onRequestTrace: vi.fn() }],
        captureGeneratedSource: true,
      })

      // Act
      const enabled = instrumentation.enabled

      // Assert
      expect(enabled).toBe(true)
    })
  })

  describe('onCompilationTrace()', () => {
    it('should emit to every sink that declares the method when sinks are configured', () => {
      // Arrange
      const firstSink = vi.fn()
      const secondSink = vi.fn()
      const event = createCompilationTraceEvent('my-journey')
      const instrumentation = new ForgeTraceSinkDispatcher({
        sinks: [
          { onRequestTrace: vi.fn(), onCompilationTrace: firstSink },
          { onRequestTrace: vi.fn(), onCompilationTrace: secondSink },
        ],
      })

      // Act
      instrumentation.onCompilationTrace(event)

      // Assert
      expect(firstSink).toHaveBeenCalledWith(event)
      expect(secondSink).toHaveBeenCalledWith(event)
    })

    it('should skip a sink without the method without throwing', () => {
      // Arrange
      const declaringSink = vi.fn()
      const event = createCompilationTraceEvent('my-journey')
      const instrumentation = new ForgeTraceSinkDispatcher({
        sinks: [{ onRequestTrace: vi.fn() }, { onRequestTrace: vi.fn(), onCompilationTrace: declaringSink }],
      })

      // Act
      instrumentation.onCompilationTrace(event)

      // Assert
      expect(declaringSink).toHaveBeenCalledWith(event)
    })
  })

  describe('onRequestTrace()', () => {
    it('should emit to every sink when sinks are configured', () => {
      // Arrange
      const firstSink = vi.fn()
      const secondSink = vi.fn()
      const event = createTraceEvent('/target')
      const instrumentation = new ForgeTraceSinkDispatcher({
        sinks: [{ onRequestTrace: firstSink }, { onRequestTrace: secondSink }],
      })

      // Act
      instrumentation.onRequestTrace(event)

      // Assert
      expect(firstSink).toHaveBeenCalledWith(event)
      expect(secondSink).toHaveBeenCalledWith(event)
    })

    it('should allow sinks to ignore events when they filter internally', () => {
      // Arrange
      const emitted: RequestTraceEvent[] = []
      const targetEvent = createTraceEvent('/target')
      const ignoredEvent = createTraceEvent('/ignored')
      const instrumentation = new ForgeTraceSinkDispatcher({
        sinks: [
          {
            onRequestTrace: event => {
              if (event.snapshot.location.pathname !== '/target') {
                return
              }

              emitted.push(event)
            },
          },
        ],
      })

      // Act
      instrumentation.onRequestTrace(targetEvent)
      instrumentation.onRequestTrace(ignoredEvent)

      // Assert
      expect(emitted).toEqual([targetEvent])
    })
  })
})

function createTraceEvent(pathname: string): RequestTraceEvent {
  return {
    snapshot: {
      nodeId: 'node',
      method: 'GET',
      location: {
        origin: 'http://localhost',
        href: `http://localhost${pathname}`,
        pathname,
        basePath: '',
      },
      params: {},
      query: {},
      post: {},
      headers: {},
      cookies: {},
      state: {},
      session: undefined,
    },
    trace: {
      outcome: 'render',
      startedAtMs: 0,
      completedAtMs: 1,
      durationMs: 1,
      phases: [],
    },
  }
}

function createCompilationTraceEvent(journeyCode: string): CompilationTraceEvent {
  return {
    journeyCode,
    trace: {
      outcome: 'compiled',
      startedAtMs: 0,
      completedAtMs: 1,
      durationMs: 1,
      phases: [],
    },
  }
}
