import ASTNodeTree from './ASTNodeTree'
import { NodeId } from '../../types/engine.type'

describe('ASTNodeTree', () => {
  describe('addNode()', () => {
    it('should record parent relationships when parent exists', () => {
      // Arrange
      const tree = new ASTNodeTree()

      // Act
      tree.addNode('root' as NodeId)
      tree.addNode('child1' as NodeId, 'root' as NodeId)
      tree.addNode('child2' as NodeId, 'root' as NodeId)

      // Assert
      expect(tree.getParent('child1' as NodeId)).toBe('root')
      expect(tree.getParent('child2' as NodeId)).toBe('root')
    })

    it('should leave root nodes without parents', () => {
      // Arrange
      const tree = new ASTNodeTree()

      // Act
      tree.addNode('root' as NodeId)

      // Assert
      expect(tree.getParent('root' as NodeId)).toBeUndefined()
    })
  })

  describe('getParent()', () => {
    it('should return undefined when node is unknown', () => {
      // Arrange
      const tree = new ASTNodeTree()

      // Act
      const parent = tree.getParent('unknown' as NodeId)

      // Assert
      expect(parent).toBeUndefined()
    })
  })

  describe('isDescendantOf()', () => {
    it('should return true when node is a direct child', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('root' as NodeId)
      tree.addNode('child' as NodeId, 'root' as NodeId)

      // Act
      const result = tree.isDescendantOf('child' as NodeId, 'root' as NodeId)

      // Assert
      expect(result).toBe(true)
    })

    it('should return true when node is a nested descendant', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('root' as NodeId)
      tree.addNode('middle' as NodeId, 'root' as NodeId)
      tree.addNode('leaf' as NodeId, 'middle' as NodeId)

      // Act
      const result = tree.isDescendantOf('leaf' as NodeId, 'root' as NodeId)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when nodes are siblings', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('root' as NodeId)
      tree.addNode('a' as NodeId, 'root' as NodeId)
      tree.addNode('b' as NodeId, 'root' as NodeId)

      // Act
      const result = tree.isDescendantOf('a' as NodeId, 'b' as NodeId)

      // Assert
      expect(result).toBe(false)
    })

    it('should return false when node is itself', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('root' as NodeId)

      // Act
      const result = tree.isDescendantOf('root' as NodeId, 'root' as NodeId)

      // Assert
      expect(result).toBe(false)
    })

    it('should return false when node is unknown', () => {
      // Arrange
      const tree = new ASTNodeTree()

      // Act
      const result = tree.isDescendantOf('unknown' as NodeId, 'other' as NodeId)

      // Assert
      expect(result).toBe(false)
    })
  })
})
