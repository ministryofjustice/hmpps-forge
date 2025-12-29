import { NodeId } from '@form-engine/core/types/engine.type'
import { ThunkHandler, ThunkResult } from '../types'
import ThunkHandlerRegistry from './ThunkHandlerRegistry'
import OverlayThunkHandlerRegistry from './OverlayThunkHandlerRegistry'

const createHandler = (id: NodeId): ThunkHandler => ({
  nodeId: id,
  isAsync: true as const,
  async evaluate() {
    const result: ThunkResult = {
      value: id,
      metadata: {
        source: 'OverlayThunkHandlerRegistry.test',
        timestamp: Date.now(),
      },
    }

    return result
  },
})

describe('OverlayThunkHandlerRegistry', () => {
  let mainRegistry: ThunkHandlerRegistry
  let overlayRegistry: OverlayThunkHandlerRegistry

  beforeEach(() => {
    mainRegistry = new ThunkHandlerRegistry()
    overlayRegistry = new OverlayThunkHandlerRegistry(mainRegistry)
  })

  describe('register()', () => {
    it('should register handlers to pending registry', () => {
      // Arrange
      const nodeId: NodeId = 'runtime_ast:1'
      const handler = createHandler(nodeId)

      // Act
      overlayRegistry.register(nodeId, handler)

      // Assert
      expect(overlayRegistry.has(nodeId)).toBe(true)
      expect(mainRegistry.has(nodeId)).toBe(false)
    })

    it('should throw when registering duplicate in pending', () => {
      // Arrange
      const nodeId: NodeId = 'runtime_ast:2'
      const handler = createHandler(nodeId)
      overlayRegistry.register(nodeId, handler)

      // Act & Assert
      expect(() => overlayRegistry.register(nodeId, createHandler(nodeId))).toThrow()
    })

    it('should throw when registering duplicate of main registry handler', () => {
      // Arrange
      const nodeId: NodeId = 'compile_ast:1'
      const handler = createHandler(nodeId)
      mainRegistry.register(nodeId, handler)

      // Act & Assert
      expect(() => overlayRegistry.register(nodeId, createHandler(nodeId))).toThrow()
    })
  })

  describe('get()', () => {
    it('should return handler from pending registry first', () => {
      // Arrange
      const nodeId: NodeId = 'runtime_ast:3'
      const pendingHandler = createHandler(nodeId)
      overlayRegistry.register(nodeId, pendingHandler)

      // Act
      const result = overlayRegistry.get(nodeId)

      // Assert
      expect(result).toBe(pendingHandler)
    })

    it('should fall back to main registry when not in pending', () => {
      // Arrange
      const nodeId: NodeId = 'compile_ast:2'
      const mainHandler = createHandler(nodeId)
      mainRegistry.register(nodeId, mainHandler)

      // Act
      const result = overlayRegistry.get(nodeId)

      // Assert
      expect(result).toBe(mainHandler)
    })

    it('should return undefined when not in either registry', () => {
      // Arrange
      const nodeId: NodeId = 'compile_ast:999'

      // Act
      const result = overlayRegistry.get(nodeId)

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('has()', () => {
    it('should return true when handler exists in pending', () => {
      // Arrange
      const nodeId: NodeId = 'runtime_ast:4'
      overlayRegistry.register(nodeId, createHandler(nodeId))

      // Act & Assert
      expect(overlayRegistry.has(nodeId)).toBe(true)
    })

    it('should return true when handler exists in main', () => {
      // Arrange
      const nodeId: NodeId = 'compile_ast:3'
      mainRegistry.register(nodeId, createHandler(nodeId))

      // Act & Assert
      expect(overlayRegistry.has(nodeId)).toBe(true)
    })

    it('should return false when handler not in either registry', () => {
      // Arrange
      const nodeId: NodeId = 'compile_ast:998'

      // Act & Assert
      expect(overlayRegistry.has(nodeId)).toBe(false)
    })
  })

  describe('getAll()', () => {
    it('should return merged handlers from both registries', () => {
      // Arrange
      const mainNodeId: NodeId = 'compile_ast:4'
      const pendingNodeId: NodeId = 'runtime_ast:5'
      mainRegistry.register(mainNodeId, createHandler(mainNodeId))
      overlayRegistry.register(pendingNodeId, createHandler(pendingNodeId))

      // Act
      const result = overlayRegistry.getAll()

      // Assert
      expect(result.size).toBe(2)
      expect(result.has(mainNodeId)).toBe(true)
      expect(result.has(pendingNodeId)).toBe(true)
    })
  })

  describe('getIds()', () => {
    it('should return unique union of IDs from both registries', () => {
      // Arrange
      const mainNodeId: NodeId = 'compile_ast:5'
      const pendingNodeId: NodeId = 'runtime_ast:6'
      mainRegistry.register(mainNodeId, createHandler(mainNodeId))
      overlayRegistry.register(pendingNodeId, createHandler(pendingNodeId))

      // Act
      const result = overlayRegistry.getIds()

      // Assert
      expect(result).toHaveLength(2)
      expect(result).toContain(mainNodeId)
      expect(result).toContain(pendingNodeId)
    })
  })

  describe('size()', () => {
    it('should return total count from both registries', () => {
      // Arrange
      mainRegistry.register('compile_ast:6', createHandler('compile_ast:6'))
      mainRegistry.register('compile_ast:7', createHandler('compile_ast:7'))
      overlayRegistry.register('runtime_ast:7', createHandler('runtime_ast:7'))

      // Act & Assert
      expect(overlayRegistry.size()).toBe(3)
    })
  })

  describe('clone()', () => {
    it('should throw an error', () => {
      // Act & Assert
      expect(() => overlayRegistry.clone()).toThrow('Cannot clone an OverlayThunkHandlerRegistry')
    })
  })

  describe('flushIntoMain()', () => {
    it('should move pending handlers into main registry', () => {
      // Arrange
      const pendingNodeId: NodeId = 'runtime_ast:8'
      overlayRegistry.register(pendingNodeId, createHandler(pendingNodeId))

      // Act
      overlayRegistry.flushIntoMain()

      // Assert
      expect(mainRegistry.has(pendingNodeId)).toBe(true)
    })

    it('should clear pending after flush', () => {
      // Arrange
      const pendingNodeId: NodeId = 'runtime_ast:9'
      overlayRegistry.register(pendingNodeId, createHandler(pendingNodeId))

      // Act
      overlayRegistry.flushIntoMain()

      // Assert
      expect(overlayRegistry.getPendingIds()).toHaveLength(0)
    })
  })

  describe('getPendingIds()', () => {
    it('should return only pending registry IDs', () => {
      // Arrange
      const mainNodeId: NodeId = 'compile_ast:8'
      const pendingNodeId: NodeId = 'runtime_ast:10'
      mainRegistry.register(mainNodeId, createHandler(mainNodeId))
      overlayRegistry.register(pendingNodeId, createHandler(pendingNodeId))

      // Act
      const result = overlayRegistry.getPendingIds()

      // Assert
      expect(result).toHaveLength(1)
      expect(result).toContain(pendingNodeId)
      expect(result).not.toContain(mainNodeId)
    })
  })
})
