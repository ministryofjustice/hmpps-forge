import { createServer } from 'node:http'
import type { RequestTraceEvent } from '@ministryofjustice/hmpps-forge/core'
import DevToolsServer from './DevToolsServer'
import TraceDispatcher from './trace/TraceDispatcher'
import RedisTraceChannel, { type DevToolsRedisClient } from './trace/RedisTraceChannel'

type Snapshot = RequestTraceEvent['snapshot']

function snapshot(overrides: Partial<Pick<Snapshot, 'cookies' | 'headers'>> = {}): Snapshot {
  return {
    nodeId: 'journey::step',
    method: 'GET',
    location: { origin: 'http://localhost', href: 'http://localhost/step', pathname: '/step', basePath: '' },
    params: {},
    query: {},
    post: {},
    headers: overrides.headers ?? {},
    cookies: overrides.cookies ?? {},
    state: {},
    session: {},
  }
}

function server(): DevToolsServer {
  return new DevToolsServer({ path: '/forge-devtools', logger: { info: () => {} } })
}

function traceEvent(): RequestTraceEvent {
  return { snapshot: snapshot(), trace: { outcome: 'render', startedAtMs: 0, phases: [] } }
}

function fakeRedisClient(): DevToolsRedisClient {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(1),
    subscribe: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue('OK'),
    duplicate: vi.fn(() => fakeRedisClient()),
  }
}

const flushMicrotasks = (): Promise<void> =>
  new Promise(resolve => {
    setImmediate(resolve)
  })

describe('DevToolsServer', () => {
  describe('onRequestTrace()', () => {
    it('should dispatch locally when no Redis channel is configured', () => {
      // Arrange
      const dispatch = vi.spyOn(TraceDispatcher.prototype, 'onRequestTrace').mockImplementation(() => {})
      const event = traceEvent()

      // Act
      server().onRequestTrace(event)

      // Assert
      expect(dispatch).toHaveBeenCalledWith(event)
    })

    it('should publish and not dispatch locally when a Redis channel is configured', () => {
      // Arrange
      const channel = new RedisTraceChannel(fakeRedisClient(), { warn: () => {} })
      const publish = vi.spyOn(channel, 'publish').mockResolvedValue()
      const dispatch = vi.spyOn(TraceDispatcher.prototype, 'onRequestTrace').mockImplementation(() => {})
      const withChannel = new DevToolsServer({
        path: '/forge-devtools',
        logger: { info: () => {} },
        redisChannel: channel,
      })
      const event = traceEvent()

      // Act
      withChannel.onRequestTrace(event)

      // Assert
      expect(publish).toHaveBeenCalledWith(event)
      expect(dispatch).not.toHaveBeenCalled()
    })

    it('should route subscribed Redis events to the dispatcher when attached', async () => {
      // Arrange
      const channel = new RedisTraceChannel(fakeRedisClient(), { warn: () => {} })
      let captured: ((event: RequestTraceEvent) => void) | undefined
      vi.spyOn(channel, 'connect').mockResolvedValue()
      vi.spyOn(channel, 'subscribe').mockImplementation(async onEvent => {
        captured = onEvent
      })
      const dispatch = vi.spyOn(TraceDispatcher.prototype, 'onRequestTrace').mockImplementation(() => {})
      const withChannel = new DevToolsServer({
        path: '/forge-devtools',
        logger: { info: () => {} },
        redisChannel: channel,
      })
      const httpServer = createServer()
      const event = traceEvent()

      // Act
      withChannel.attach(httpServer)
      await flushMicrotasks()
      captured?.(event)

      // Assert
      expect(dispatch).toHaveBeenCalledWith(event)
      withChannel.close()
      httpServer.close()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })
  })

  describe('shouldTrace()', () => {
    it('should return true when the snapshot carries the devtools cookie', () => {
      // Arrange
      const request = snapshot({ cookies: { __forgeDevtools: 'session-abc' } })

      // Act
      const result = server().shouldTrace(request)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when the snapshot does not carry the devtools cookie', () => {
      // Arrange
      const request = snapshot({ cookies: { other: 'x' } })

      // Act
      const result = server().shouldTrace(request)

      // Assert
      expect(result).toBe(false)
    })
  })
})
