import { subscribe, unsubscribe } from 'node:diagnostics_channel'
import type { RequestTraceEvent } from '../../../../framework/types/traceObserver.type'
import { createChannelTraceObserver, FORGE_REQUEST_COMPLETE_CHANNEL } from './channelTraceObserver'

describe('createChannelTraceObserver', () => {
  // Channels are process-global singletons, so every subscription must be
  // removed or hasSubscribers leaks into other tests.
  const subscribers: ((message: unknown) => void)[] = []

  function subscribeListener(): ReturnType<typeof vi.fn> {
    const listener = vi.fn()
    subscribe(FORGE_REQUEST_COMPLETE_CHANNEL, listener)
    subscribers.push(listener)

    return listener
  }

  afterEach(() => {
    subscribers.forEach(listener => unsubscribe(FORGE_REQUEST_COMPLETE_CHANNEL, listener))
    subscribers.length = 0
  })

  function buildTraceEvent(): RequestTraceEvent {
    return {
      snapshot: {
        nodeId: 'test::compile_ast:1',
        method: 'GET',
        location: {
          origin: 'http://localhost',
          href: 'http://localhost/journey/step-one',
          pathname: '/journey/step-one',
          basePath: '/journey',
        },
        params: {},
        query: {},
        post: {},
        headers: {},
        cookies: {},
        state: {},
        session: undefined,
      },
      trace: { outcome: 'render', durationMs: 1, phases: [] },
    }
  }

  describe('shouldTrace()', () => {
    it('should return false when the channel has no subscribers', () => {
      // Arrange
      const observer = createChannelTraceObserver()

      // Act
      const result = observer.shouldTrace(buildTraceEvent().snapshot)

      // Assert
      expect(result).toBe(false)
    })

    it('should return true when the channel has a subscriber', () => {
      // Arrange
      const observer = createChannelTraceObserver()
      subscribeListener()

      // Act
      const result = observer.shouldTrace(buildTraceEvent().snapshot)

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('onTrace()', () => {
    it('should publish the event to channel subscribers when called', () => {
      // Arrange
      const observer = createChannelTraceObserver()
      const listener = subscribeListener()
      const event = buildTraceEvent()

      // Act
      observer.onTrace(event)

      // Assert
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith(event, FORGE_REQUEST_COMPLETE_CHANNEL)
    })
  })
})
