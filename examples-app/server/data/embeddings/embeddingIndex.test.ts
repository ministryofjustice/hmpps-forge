import { EventEmitter } from 'node:events'
import EmbeddingIndex from './embeddingIndex'

jest.mock('node:worker_threads', () => {
  const mockWorker = new EventEmitter()
  Object.assign(mockWorker, {
    postMessage: jest.fn(),
    terminate: jest.fn(),
  })

  return {
    Worker: jest.fn(() => mockWorker),
    __mockWorker: mockWorker,
  }
})

function getMockWorker(): EventEmitter & { postMessage: jest.Mock; terminate: jest.Mock } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, n/global-require
  const { __mockWorker } = require('node:worker_threads')

  return __mockWorker
}

describe('EmbeddingIndex', () => {
  let index: EmbeddingIndex
  let mockWorker: EventEmitter & { postMessage: jest.Mock; terminate: jest.Mock }

  beforeEach(() => {
    jest.clearAllMocks()
    mockWorker = getMockWorker()
    mockWorker.removeAllListeners()
    index = new EmbeddingIndex()
  })

  afterEach(() => {
    index.shutdown()
    mockWorker.removeAllListeners()
  })

  describe('buildIndex()', () => {
    it('should start in idle state and not be ready', () => {
      // Arrange / Act (no action)

      // Assert
      expect(index.isReady).toBe(false)
    })

    it('should transition to ready when worker completes', () => {
      // Arrange
      const texts = ['some text long enough to be meaningful']

      // Act
      index.buildIndex(texts)
      mockWorker.emit('message', {
        type: 'embedded',
        vectors: [[0.1, 0.2, 0.3]],
      })

      // Assert
      expect(index.isReady).toBe(true)
    })

    it('should send texts to the worker', () => {
      // Arrange
      const texts = ['first chunk of text', 'second chunk of text']

      // Act
      index.buildIndex(texts)

      // Assert
      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: 'embed',
        texts: ['first chunk of text', 'second chunk of text'],
      })
    })

    it('should not rebuild if already loading', () => {
      // Arrange
      const texts = ['some text']

      // Act
      index.buildIndex(texts)
      index.buildIndex(texts)

      // Assert
      expect(mockWorker.postMessage).toHaveBeenCalledTimes(1)
    })

    it('should set failed state on worker error message', () => {
      // Arrange
      const texts = ['some text']

      // Act
      index.buildIndex(texts)
      mockWorker.emit('message', { type: 'error', message: 'Model load failed' })

      // Assert
      expect(index.isReady).toBe(false)
    })

    it('should set failed state on worker crash', () => {
      // Arrange
      const texts = ['some text']

      // Act
      index.buildIndex(texts)
      mockWorker.emit('error', new Error('Worker crashed'))

      // Assert
      expect(index.isReady).toBe(false)
    })

    it('should handle empty texts', () => {
      // Arrange / Act
      index.buildIndex([])

      // Assert
      expect(index.isReady).toBe(true)
      expect(mockWorker.postMessage).not.toHaveBeenCalled()
    })
  })

  describe('search()', () => {
    it('should return empty results when not ready', async () => {
      // Arrange / Act
      const results = await index.search('test query')

      // Assert
      expect(results).toEqual([])
    })

    it('should return scored matches sorted by score', async () => {
      // Arrange
      index.buildIndex(['first chunk', 'second chunk'])
      mockWorker.emit('message', {
        type: 'embedded',
        vectors: [
          [1, 0, 0],
          [0.9, 0.1, 0],
        ],
      })

      // Act
      const searchPromise = index.search('test')
      mockWorker.emit('message', {
        type: 'queryResult',
        vector: [1, 0, 0],
      })
      const results = await searchPromise

      // Assert
      expect(results).toHaveLength(2)
      expect(results[0].index).toBe(0)
      expect(results[0].score).toBeGreaterThan(results[1].score)
    })

    it('should filter out results below the minimum score', async () => {
      // Arrange
      index.buildIndex(['relevant chunk', 'irrelevant chunk'])
      mockWorker.emit('message', {
        type: 'embedded',
        vectors: [
          [1, 0, 0],
          [0, 0, 1],
        ],
      })

      // Act
      const searchPromise = index.search('test', 10, 0.5)
      mockWorker.emit('message', {
        type: 'queryResult',
        vector: [1, 0, 0],
      })
      const results = await searchPromise

      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].index).toBe(0)
    })
  })
})
