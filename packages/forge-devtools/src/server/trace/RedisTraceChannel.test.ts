import { gunzipSync, gzipSync } from 'node:zlib'
import type { Mock } from 'vitest'
import type { RequestTraceEvent } from '@ministryofjustice/hmpps-forge/core'
import RedisTraceChannel from './RedisTraceChannel'

interface FakeRedisClient {
  connect: Mock<() => Promise<unknown>>
  publish: Mock<(channel: string, message: string | Buffer) => Promise<unknown>>
  subscribe: Mock<(channel: string, listener: (message: Buffer) => void, bufferMode: true) => Promise<unknown>>
  quit: Mock<() => Promise<unknown>>
  duplicate: Mock<() => FakeRedisClient>
}

function fakeClient(): FakeRedisClient {
  return {
    connect: vi.fn<() => Promise<unknown>>().mockResolvedValue(undefined),
    publish: vi.fn<(channel: string, message: string | Buffer) => Promise<unknown>>().mockResolvedValue(1),
    subscribe: vi.fn<(channel: string, listener: (message: Buffer) => void, bufferMode: true) => Promise<unknown>>()
      .mockResolvedValue(undefined),
    quit: vi.fn<() => Promise<unknown>>().mockResolvedValue('OK'),
    duplicate: vi.fn<() => FakeRedisClient>(() => fakeClient()),
  }
}

function traceEvent(): RequestTraceEvent {
  return {
    snapshot: {
      nodeId: 'journey::step',
      method: 'GET',
      location: { origin: 'http://localhost', href: 'http://localhost/step', pathname: '/step', basePath: '' },
      params: {},
      query: {},
      post: {},
      headers: {},
      cookies: {},
      state: {},
      session: {},
    },
    trace: { outcome: 'render', startedAtMs: 0, phases: [] },
  }
}

function duplicatesOf(client: FakeRedisClient): { publisher: FakeRedisClient; subscriber: FakeRedisClient } {
  const [publisher, subscriber] = client.duplicate.mock.results.map(result => result.value)

  return { publisher, subscriber }
}

describe('RedisTraceChannel', () => {
  const logger = { warn: vi.fn() }

  beforeEach(() => {
    logger.warn.mockClear()
  })

  describe('constructor', () => {
    it('should duplicate the caller client twice and never use the original when constructed', () => {
      // Arrange
      const original = fakeClient()

      // Act
      const channel = new RedisTraceChannel(original, logger)

      // Assert
      expect(channel).toBeInstanceOf(RedisTraceChannel)
      expect(original.duplicate).toHaveBeenCalledTimes(2)
      expect(original.publish).not.toHaveBeenCalled()
      expect(original.subscribe).not.toHaveBeenCalled()
    })
  })

  describe('publish()', () => {
    it('should gzip the event and publish it on the publisher duplicate when publishing', async () => {
      // Arrange
      const original = fakeClient()
      const channel = new RedisTraceChannel(original, logger)
      const { publisher, subscriber } = duplicatesOf(original)
      const event = traceEvent()

      // Act
      await channel.publish(event)

      // Assert
      expect(subscriber.publish).not.toHaveBeenCalled()
      const [channelName, payload] = publisher.publish.mock.calls[0]
      expect(channelName).toBe('__forgeDevtools:traces')
      expect(JSON.parse(gunzipSync(payload).toString())).toEqual(event)
    })

    it('should swallow and log the failure when the publish rejects', async () => {
      // Arrange
      const original = fakeClient()
      const channel = new RedisTraceChannel(original, logger)
      const { publisher } = duplicatesOf(original)
      publisher.publish.mockRejectedValue(new Error('redis down'))

      // Act
      const result = channel.publish(traceEvent())

      // Assert
      await expect(result).resolves.toBeUndefined()
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('redis down'))
    })
  })

  describe('subscribe()', () => {
    it('should inflate the message and forward the event when a trace arrives', async () => {
      // Arrange
      const original = fakeClient()
      const channel = new RedisTraceChannel(original, logger)
      const { subscriber } = duplicatesOf(original)
      const onEvent = vi.fn()
      const event = traceEvent()

      // Act
      await channel.subscribe(onEvent)
      const listener = subscriber.subscribe.mock.calls[0][1]
      listener(gzipSync(JSON.stringify(event)))

      // Assert
      expect(subscriber.subscribe).toHaveBeenCalledWith('__forgeDevtools:traces', expect.any(Function), true)
      expect(onEvent).toHaveBeenCalledWith(event)
    })

    it('should drop the message without throwing when it is malformed', async () => {
      // Arrange
      const original = fakeClient()
      const channel = new RedisTraceChannel(original, logger)
      const { subscriber } = duplicatesOf(original)
      const onEvent = vi.fn()
      await channel.subscribe(onEvent)
      const listener = subscriber.subscribe.mock.calls[0][1]

      // Act
      listener(Buffer.from('not gzip'))

      // Assert
      expect(onEvent).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalled()
    })
  })

  describe('close()', () => {
    it('should quit both duplicates when closing', async () => {
      // Arrange
      const original = fakeClient()
      const channel = new RedisTraceChannel(original, logger)
      const { publisher, subscriber } = duplicatesOf(original)

      // Act
      await channel.close()

      // Assert
      expect(publisher.quit).toHaveBeenCalledTimes(1)
      expect(subscriber.quit).toHaveBeenCalledTimes(1)
    })
  })
})
