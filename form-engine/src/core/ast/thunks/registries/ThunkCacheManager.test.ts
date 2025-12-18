import { NodeId } from '@form-engine/core/types/engine.type'
import { ThunkResult } from '@form-engine/core/ast/thunks/types'
import DependencyGraph from '@form-engine/core/ast/dependencies/DependencyGraph'
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

const createMockDependencyGraph = (dependentsMap: Map<NodeId, NodeId[]>): DependencyGraph => {
  return {
    getDependents: (nodeId: NodeId) => dependentsMap.get(nodeId) ?? [],
  } as unknown as DependencyGraph
}

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

  describe('getWithCachedFlag()', () => {
    it('should return undefined when node is not cached', () => {
      // Arrange
      const nodeId: NodeId = 'compile_pseudo:1'

      // Act
      const result = cacheManager.getWithCachedFlag(nodeId)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should return value result with cached flag set to true', () => {
      // Arrange
      const nodeId: NodeId = 'compile_pseudo:1'
      const cachedResult = createSuccessResult('cached value')
      cacheManager.set(nodeId, cachedResult)

      // Act
      const result = cacheManager.getWithCachedFlag<string>(nodeId)

      // Assert
      expect(result).toBeDefined()
      expect(result?.value).toBe('cached value')
      expect(result?.metadata.cached).toBe(true)
    })

    it('should return error result with cached flag set to true', () => {
      // Arrange
      const nodeId: NodeId = 'compile_pseudo:1'
      const errorResult = createErrorResult(nodeId, 'Cached error')
      cacheManager.set(nodeId, errorResult)

      // Act
      const result = cacheManager.getWithCachedFlag(nodeId)

      // Assert
      expect(result).toBeDefined()
      expect(result?.error?.message).toBe('Cached error')
      expect(result?.metadata.cached).toBe(true)
    })

    it('should preserve existing metadata when adding cached flag', () => {
      // Arrange
      const nodeId: NodeId = 'compile_pseudo:1'
      const cachedResult: ThunkResult<string> = {
        value: 'test',
        metadata: {
          source: 'original-source',
          timestamp: 12345,
          dependencies: ['compile_pseudo:2' as NodeId],
        },
      }
      cacheManager.set(nodeId, cachedResult)

      // Act
      const result = cacheManager.getWithCachedFlag<string>(nodeId)

      // Assert
      expect(result?.metadata.source).toBe('original-source')
      expect(result?.metadata.timestamp).toBe(12345)
      expect(result?.metadata.dependencies).toEqual(['compile_pseudo:2'])
      expect(result?.metadata.cached).toBe(true)
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

  describe('delete()', () => {
    it('should remove cached result', () => {
      // Arrange
      const nodeId: NodeId = 'compile_pseudo:1'
      cacheManager.set(nodeId, createSuccessResult('value'))

      // Act
      cacheManager.delete(nodeId)

      // Assert
      expect(cacheManager.has(nodeId)).toBe(false)
      expect(cacheManager.get(nodeId)).toBeUndefined()
    })

    it('should not throw when deleting non-existent node', () => {
      // Arrange
      const nodeId: NodeId = 'compile_pseudo:1'

      // Act & Assert
      expect(() => cacheManager.delete(nodeId)).not.toThrow()
    })
  })

  describe('getVersion()', () => {
    it('should return 0 for node with no version history', () => {
      // Arrange
      const nodeId: NodeId = 'compile_pseudo:1'

      // Act
      const version = cacheManager.getVersion(nodeId)

      // Assert
      expect(version).toBe(0)
    })

    it('should return current version after increment', () => {
      // Arrange
      const nodeId: NodeId = 'compile_pseudo:1'
      cacheManager.incrementVersion(nodeId)

      // Act
      const version = cacheManager.getVersion(nodeId)

      // Assert
      expect(version).toBe(1)
    })
  })

  describe('incrementVersion()', () => {
    it('should increment version from 0 to 1', () => {
      // Arrange
      const nodeId: NodeId = 'compile_pseudo:1'

      // Act
      cacheManager.incrementVersion(nodeId)

      // Assert
      expect(cacheManager.getVersion(nodeId)).toBe(1)
    })

    it('should increment version multiple times', () => {
      // Arrange
      const nodeId: NodeId = 'compile_pseudo:1'

      // Act
      cacheManager.incrementVersion(nodeId)
      cacheManager.incrementVersion(nodeId)
      cacheManager.incrementVersion(nodeId)

      // Assert
      expect(cacheManager.getVersion(nodeId)).toBe(3)
    })

    it('should track versions independently per node', () => {
      // Arrange
      const nodeA: NodeId = 'compile_pseudo:1'
      const nodeB: NodeId = 'compile_pseudo:2'

      // Act
      cacheManager.incrementVersion(nodeA)
      cacheManager.incrementVersion(nodeA)
      cacheManager.incrementVersion(nodeB)

      // Assert
      expect(cacheManager.getVersion(nodeA)).toBe(2)
      expect(cacheManager.getVersion(nodeB)).toBe(1)
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

    it('should clear all version counters', () => {
      // Arrange
      const nodeA: NodeId = 'compile_pseudo:1'
      const nodeB: NodeId = 'compile_pseudo:2'
      cacheManager.incrementVersion(nodeA)
      cacheManager.incrementVersion(nodeA)
      cacheManager.incrementVersion(nodeB)

      // Act
      cacheManager.reset()

      // Assert
      expect(cacheManager.getVersion(nodeA)).toBe(0)
      expect(cacheManager.getVersion(nodeB)).toBe(0)
    })
  })

  describe('invalidateCascading()', () => {
    it('should increment version of invalidated node', () => {
      // Arrange
      const nodeId: NodeId = 'compile_pseudo:1'
      const graph = createMockDependencyGraph(new Map())

      // Act
      cacheManager.invalidateCascading(nodeId, graph)

      // Assert
      expect(cacheManager.getVersion(nodeId)).toBe(1)
    })

    it('should remove invalidated node from cache', () => {
      // Arrange
      const nodeId: NodeId = 'compile_pseudo:1'
      const graph = createMockDependencyGraph(new Map())
      cacheManager.set(nodeId, createSuccessResult('cached'))

      // Act
      cacheManager.invalidateCascading(nodeId, graph)

      // Assert
      expect(cacheManager.has(nodeId)).toBe(false)
    })

    it('should increment version even when node is not cached', () => {
      // Arrange
      const nodeId: NodeId = 'compile_pseudo:1'
      const graph = createMockDependencyGraph(new Map())

      // Act
      cacheManager.invalidateCascading(nodeId, graph)

      // Assert
      expect(cacheManager.getVersion(nodeId)).toBe(1)
    })

    it('should cascade invalidation to dependent nodes', () => {
      // Arrange
      //     A
      //    / \
      //   B   C
      const nodeA: NodeId = 'compile_pseudo:1'
      const nodeB: NodeId = 'compile_pseudo:2'
      const nodeC: NodeId = 'compile_pseudo:3'

      const dependentsMap = new Map<NodeId, NodeId[]>([[nodeA, [nodeB, nodeC]]])
      const graph = createMockDependencyGraph(dependentsMap)

      cacheManager.set(nodeA, createSuccessResult('A'))
      cacheManager.set(nodeB, createSuccessResult('B'))
      cacheManager.set(nodeC, createSuccessResult('C'))

      // Act
      cacheManager.invalidateCascading(nodeA, graph)

      // Assert
      expect(cacheManager.has(nodeA)).toBe(false)
      expect(cacheManager.has(nodeB)).toBe(false)
      expect(cacheManager.has(nodeC)).toBe(false)

      expect(cacheManager.getVersion(nodeA)).toBe(1)
      expect(cacheManager.getVersion(nodeB)).toBe(1)
      expect(cacheManager.getVersion(nodeC)).toBe(1)
    })

    it('should cascade invalidation through multiple levels', () => {
      // Arrange
      //   A → B → C → D
      const nodeA: NodeId = 'compile_pseudo:1'
      const nodeB: NodeId = 'compile_pseudo:2'
      const nodeC: NodeId = 'compile_pseudo:3'
      const nodeD: NodeId = 'compile_pseudo:4'

      const dependentsMap = new Map<NodeId, NodeId[]>([
        [nodeA, [nodeB]],
        [nodeB, [nodeC]],
        [nodeC, [nodeD]],
      ])
      const graph = createMockDependencyGraph(dependentsMap)

      cacheManager.set(nodeA, createSuccessResult('A'))
      cacheManager.set(nodeB, createSuccessResult('B'))
      cacheManager.set(nodeC, createSuccessResult('C'))
      cacheManager.set(nodeD, createSuccessResult('D'))

      // Act
      cacheManager.invalidateCascading(nodeA, graph)

      // Assert
      expect(cacheManager.has(nodeA)).toBe(false)
      expect(cacheManager.has(nodeB)).toBe(false)
      expect(cacheManager.has(nodeC)).toBe(false)
      expect(cacheManager.has(nodeD)).toBe(false)
    })

    it('should not affect nodes that are not dependents', () => {
      // Arrange
      //   A → B    C (independent)
      const nodeA: NodeId = 'compile_pseudo:1'
      const nodeB: NodeId = 'compile_pseudo:2'
      const nodeC: NodeId = 'compile_pseudo:3'

      const dependentsMap = new Map<NodeId, NodeId[]>([[nodeA, [nodeB]]])
      const graph = createMockDependencyGraph(dependentsMap)

      cacheManager.set(nodeA, createSuccessResult('A'))
      cacheManager.set(nodeB, createSuccessResult('B'))
      cacheManager.set(nodeC, createSuccessResult('C'))

      // Act
      cacheManager.invalidateCascading(nodeA, graph)

      // Assert
      expect(cacheManager.has(nodeA)).toBe(false)
      expect(cacheManager.has(nodeB)).toBe(false)
      expect(cacheManager.has(nodeC)).toBe(true)
      expect(cacheManager.getVersion(nodeC)).toBe(0)
    })

    it('should handle circular dependencies without infinite recursion', () => {
      // Arrange
      //   A → B → A (circular)
      const nodeA: NodeId = 'compile_pseudo:1'
      const nodeB: NodeId = 'compile_pseudo:2'

      const dependentsMap = new Map<NodeId, NodeId[]>([
        [nodeA, [nodeB]],
        [nodeB, [nodeA]],
      ])
      const graph = createMockDependencyGraph(dependentsMap)

      cacheManager.set(nodeA, createSuccessResult('A'))
      cacheManager.set(nodeB, createSuccessResult('B'))

      // Act & Assert
      expect(() => cacheManager.invalidateCascading(nodeA, graph)).not.toThrow()
      expect(cacheManager.has(nodeA)).toBe(false)
      expect(cacheManager.has(nodeB)).toBe(false)
    })

    it('should increment version only once per node in diamond dependencies', () => {
      // Arrange
      //     A
      //    / \
      //   B   C
      //    \ /
      //     D
      const nodeA: NodeId = 'compile_pseudo:1'
      const nodeB: NodeId = 'compile_pseudo:2'
      const nodeC: NodeId = 'compile_pseudo:3'
      const nodeD: NodeId = 'compile_pseudo:4'

      const dependentsMap = new Map<NodeId, NodeId[]>([
        [nodeA, [nodeB, nodeC]],
        [nodeB, [nodeD]],
        [nodeC, [nodeD]],
      ])
      const graph = createMockDependencyGraph(dependentsMap)

      cacheManager.set(nodeA, createSuccessResult('A'))
      cacheManager.set(nodeB, createSuccessResult('B'))
      cacheManager.set(nodeC, createSuccessResult('C'))
      cacheManager.set(nodeD, createSuccessResult('D'))

      // Act
      cacheManager.invalidateCascading(nodeA, graph)

      // Assert
      expect(cacheManager.has(nodeD)).toBe(false)
      expect(cacheManager.getVersion(nodeD)).toBe(1)
    })
  })
})
