import ASTNodeTree from '@form-engine/core/compilation/node-tree/ASTNodeTree'
import { NodeId } from '@form-engine/core/types/engine.type'

describe('ASTNodeTree', () => {
  describe('addNode()', () => {
    it('should build parent/children relationships', () => {
      // Arrange
      const tree = new ASTNodeTree()

      // Act
      tree.addNode('root' as NodeId)
      tree.addNode('child1' as NodeId, 'root' as NodeId)
      tree.addNode('child2' as NodeId, 'root' as NodeId)

      // Assert
      expect(tree.getParent('child1' as NodeId)).toBe('root')
      expect(tree.getParent('child2' as NodeId)).toBe('root')
      expect(tree.getChildren('root' as NodeId)).toEqual(['child1', 'child2'])
    })

    it('should treat nodes without parentId as roots', () => {
      // Arrange
      const tree = new ASTNodeTree()

      // Act
      tree.addNode('root' as NodeId)

      // Assert
      expect(tree.getParent('root' as NodeId)).toBeUndefined()
    })
  })

  describe('getParent()', () => {
    it('should return undefined for root nodes', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('root' as NodeId)

      // Act
      const parent = tree.getParent('root' as NodeId)

      // Assert
      expect(parent).toBeUndefined()
    })

    it('should return parent for child nodes', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('root' as NodeId)
      tree.addNode('child' as NodeId, 'root' as NodeId)

      // Act
      const parent = tree.getParent('child' as NodeId)

      // Assert
      expect(parent).toBe('root')
    })

    it('should return undefined for unknown nodes', () => {
      // Arrange
      const tree = new ASTNodeTree()

      // Act
      const parent = tree.getParent('unknown' as NodeId)

      // Assert
      expect(parent).toBeUndefined()
    })
  })

  describe('getChildren()', () => {
    it('should return children in insertion order', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('root' as NodeId)
      tree.addNode('a' as NodeId, 'root' as NodeId)
      tree.addNode('b' as NodeId, 'root' as NodeId)
      tree.addNode('c' as NodeId, 'root' as NodeId)

      // Act
      const children = tree.getChildren('root' as NodeId)

      // Assert
      expect(children).toEqual(['a', 'b', 'c'])
    })

    it('should return empty array for leaf nodes', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('root' as NodeId)
      tree.addNode('leaf' as NodeId, 'root' as NodeId)

      // Act
      const children = tree.getChildren('leaf' as NodeId)

      // Assert
      expect(children).toEqual([])
    })

    it('should return empty array for unknown nodes', () => {
      // Arrange
      const tree = new ASTNodeTree()

      // Act
      const children = tree.getChildren('unknown' as NodeId)

      // Assert
      expect(children).toEqual([])
    })
  })

  describe('isLeaf()', () => {
    it('should return true for childless nodes', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('root' as NodeId)
      tree.addNode('leaf' as NodeId, 'root' as NodeId)

      // Act & Assert
      expect(tree.isLeaf('leaf' as NodeId)).toBe(true)
    })

    it('should return false for nodes with children', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('root' as NodeId)
      tree.addNode('child' as NodeId, 'root' as NodeId)

      // Act & Assert
      expect(tree.isLeaf('root' as NodeId)).toBe(false)
    })

    it('should return true for unknown nodes', () => {
      // Arrange
      const tree = new ASTNodeTree()

      // Act & Assert
      expect(tree.isLeaf('unknown' as NodeId)).toBe(true)
    })
  })

  describe('postOrder()', () => {
    it('should return leaves before parents', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('root' as NodeId)
      tree.addNode('child1' as NodeId, 'root' as NodeId)
      tree.addNode('child2' as NodeId, 'root' as NodeId)

      // Act
      const order = tree.postOrder()

      // Assert
      expect(order).toEqual(['child1', 'child2', 'root'])
    })

    it('should traverse deeply nested trees correctly', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('root' as NodeId)
      tree.addNode('a' as NodeId, 'root' as NodeId)
      tree.addNode('b' as NodeId, 'a' as NodeId)
      tree.addNode('c' as NodeId, 'a' as NodeId)
      tree.addNode('d' as NodeId, 'root' as NodeId)

      // Act
      const order = tree.postOrder()

      // Assert
      expect(order).toEqual(['b', 'c', 'a', 'd', 'root'])
    })

    it('should handle multiple roots', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('root1' as NodeId)
      tree.addNode('child1' as NodeId, 'root1' as NodeId)
      tree.addNode('root2' as NodeId)
      tree.addNode('child2' as NodeId, 'root2' as NodeId)

      // Act
      const order = tree.postOrder()

      // Assert
      expect(order).toEqual(['child1', 'root1', 'child2', 'root2'])
    })

    it('should return empty array for empty tree', () => {
      // Arrange
      const tree = new ASTNodeTree()

      // Act
      const order = tree.postOrder()

      // Assert
      expect(order).toEqual([])
    })

    it('should return single node for single-node tree', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('only' as NodeId)

      // Act
      const order = tree.postOrder()

      // Assert
      expect(order).toEqual(['only'])
    })
  })

  describe('clone()', () => {
    it('should create an independent copy', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('root' as NodeId)
      tree.addNode('child' as NodeId, 'root' as NodeId)

      // Act
      const cloned = tree.clone()
      cloned.addNode('newChild' as NodeId, 'root' as NodeId)

      // Assert
      expect(cloned.getChildren('root' as NodeId)).toEqual(['child', 'newChild'])
      expect(tree.getChildren('root' as NodeId)).toEqual(['child'])
    })
  })
})
