import { NodeId } from '@form-engine/core/types/engine.type'
import { ThunkResult } from '@form-engine/core/compilation/thunks/types'
import ThunkCacheManager from './ThunkCacheManager'

const createSuccessResult = <T>(value: T): ThunkResult<T> => ({
  value,
  metadata: {
    source: 'test',
    timestamp: Date.now(),
  },
})

const createErrorResult = (nodeId: NodeId, message: string): ThunkResult<never> => ({
  error: {
    type: 'EVALUATION_FAILED',
    nodeId,
    message,
  },
  metadata: {
    source: 'test',
    timestamp: Date.now(),
  },
})

describe('ThunkCacheManager', () => {
  let cacheManager: ThunkCacheManager

  beforeEach(() => {
    cacheManager = new ThunkCacheManager()
  })

  describe('has()', () => {
    it('should return false when node is not cached', () => {
      // Arrange
      const nodeId: NodeId = 'compile_pseudo:1'

      // Act
      const result = cacheManager.has(nodeId)

      // Assert
      expect(result).toBe(false)
    })

    it('should return true when node is cached', () => {
      // Arrange
      const nodeId: NodeId = 'compile_pseudo:1'
      cacheManager.set(nodeId, createSuccessResult('test value'))

      // Act
      const result = cacheManager.has(nodeId)

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('get()', () => {
    it('should return undefined when node is not cached', () => {
      // Arrange
      const nodeId: NodeId = 'compile_pseudo:1'

      // Act
      const result = cacheManager.get(nodeId)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should return cached value result', () => {
      // Arrange
      const nodeId: NodeId = 'compile_pseudo:1'
      const cachedResult = createSuccessResult('cached value')
      cacheManager.set(nodeId, cachedResult)

      // Act
      const result = cacheManager.get<string>(nodeId)

      // Assert
      expect(result).toBeDefined()
      expect(result?.value).toBe('cached value')
    })

    it('should return cached error result', () => {
      // Arrange
      const nodeId: NodeId = 'compile_pseudo:1'
      const errorResult = createErrorResult(nodeId, 'Something went wrong')
      cacheManager.set(nodeId, errorResult)

      // Act
      const result = cacheManager.get(nodeId)

      // Assert
      expect(result).toBeDefined()
      expect(result?.error?.message).toBe('Something went wrong')
    })
  })

  describe('set()', () => {
    it('should store a value result', () => {
      // Arrange
      const nodeId: NodeId = 'compile_pseudo:1'
      const result = createSuccessResult(42)

      // Act
      cacheManager.set(nodeId, result)

      // Assert
      expect(cacheManager.has(nodeId)).toBe(true)
      expect(cacheManager.get<number>(nodeId)?.value).toBe(42)
    })

    it('should overwrite existing cached result', () => {
      // Arrange
      const nodeId: NodeId = 'compile_pseudo:1'
      cacheManager.set(nodeId, createSuccessResult('first'))

      // Act
      cacheManager.set(nodeId, createSuccessResult('second'))

      // Assert
      expect(cacheManager.get<string>(nodeId)?.value).toBe('second')
    })
  })

  describe('reset()', () => {
    it('should clear all cached results', () => {
      // Arrange
      const nodeA: NodeId = 'compile_pseudo:1'
      const nodeB: NodeId = 'compile_pseudo:2'
      cacheManager.set(nodeA, createSuccessResult('value A'))
      cacheManager.set(nodeB, createSuccessResult('value B'))

      // Act
      cacheManager.reset()

      // Assert
      expect(cacheManager.has(nodeA)).toBe(false)
      expect(cacheManager.has(nodeB)).toBe(false)
    })
  })

  describe('clearCache()', () => {
    it('should clear all cached results', () => {
      // Arrange
      const nodeA: NodeId = 'compile_pseudo:1'
      const nodeB: NodeId = 'compile_pseudo:2'
      cacheManager.set(nodeA, createSuccessResult('A'))
      cacheManager.set(nodeB, createSuccessResult('B'))

      // Act
      cacheManager.clearCache()

      // Assert
      expect(cacheManager.has(nodeA)).toBe(false)
      expect(cacheManager.has(nodeB)).toBe(false)
    })
  })
})
