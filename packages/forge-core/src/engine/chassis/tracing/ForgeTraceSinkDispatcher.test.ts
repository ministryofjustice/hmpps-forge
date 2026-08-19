import type { RequestTraceEvent } from '../contracts/runtime/trace.type'
import type { RequestSnapshot } from '../../../framework/types/snapshot.type'
import type { CompilationTraceEvent } from '../contracts/compilation/trace.type'
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

  })

  describe('forRequest()', () => {
    it('should return a disabled view when no sinks are registered', () => {
      // Arrange
      const instrumentation = new ForgeTraceSinkDispatcher()

      // Act
      const view = instrumentation.forRequest(createSnapshot())

      // Assert
      expect(view.enabled).toBe(false)
    })

    it('should include a sink that has no shouldTrace', () => {
      // Arrange
      const instrumentation = new ForgeTraceSinkDispatcher({
        sinks: [{ onRequestTrace: vi.fn() }],
      })

      // Act
      const view = instrumentation.forRequest(createSnapshot())

      // Assert
      expect(view.enabled).toBe(true)
    })

    it('should deliver traces only to sinks that accepted the request', () => {
      // Arrange
      const acceptingSink = vi.fn()
      const decliningSink = vi.fn()
      const event = createTraceEvent('/target')
      const instrumentation = new ForgeTraceSinkDispatcher({
        sinks: [
          { onRequestTrace: acceptingSink, shouldTrace: () => true },
          { onRequestTrace: decliningSink, shouldTrace: () => false },
        ],
      })

      // Act
      const view = instrumentation.forRequest(createSnapshot())
      view.onRequestTrace(event)

      // Assert
      expect(acceptingSink).toHaveBeenCalledWith(event)
      expect(decliningSink).not.toHaveBeenCalled()
    })

    it('should return a disabled view when every sink declines the request', () => {
      // Arrange
      const instrumentation = new ForgeTraceSinkDispatcher({
        sinks: [
          { onRequestTrace: vi.fn(), shouldTrace: () => false },
          { onRequestTrace: vi.fn(), shouldTrace: () => false },
        ],
      })

      // Act
      const view = instrumentation.forRequest(createSnapshot())

      // Assert
      expect(view.enabled).toBe(false)
    })

    it('should call shouldTrace once with the snapshot even when multiple traces are delivered', () => {
      // Arrange
      const shouldTrace = vi.fn().mockReturnValue(true)
      const snapshot = createSnapshot()
      const event = createTraceEvent('/target')
      const instrumentation = new ForgeTraceSinkDispatcher({
        sinks: [{ onRequestTrace: vi.fn(), shouldTrace }],
      })

      // Act
      const view = instrumentation.forRequest(snapshot)
      view.onRequestTrace(event)
      view.onRequestTrace(event)

      // Assert
      expect(shouldTrace).toHaveBeenCalledTimes(1)
      expect(shouldTrace).toHaveBeenCalledWith(snapshot)
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

function createSnapshot(): RequestSnapshot {
  return {
    nodeId: 'node',
    method: 'GET',
    location: {
      origin: 'http://localhost',
      href: 'http://localhost/target',
      pathname: '/target',
      basePath: '',
    },
    params: {},
    query: {},
    post: {},
    headers: {},
    cookies: {},
    state: {},
    session: undefined,
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
