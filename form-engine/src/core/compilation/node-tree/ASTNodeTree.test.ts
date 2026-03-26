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

    it('should store node type when provided', () => {
      // Arrange
      const tree = new ASTNodeTree()

      // Act
      tree.addNode('node1' as NodeId, undefined, undefined, 'AstNode.Block')

      // Assert
      expect(tree.getNodeType('node1' as NodeId)).toBe('AstNode.Block')
    })

    it('should track property edges when propertyKey and parentId are provided', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('parent' as NodeId)

      // Act
      tree.addNode('child1' as NodeId, 'parent' as NodeId, 'items', 'AstNode.Block')
      tree.addNode('child2' as NodeId, 'parent' as NodeId, 'items', 'AstNode.Block')
      tree.addNode('child3' as NodeId, 'parent' as NodeId, 'hidden', 'AstNode.Expression')

      // Assert
      expect(tree.getActivePropertyKeys('parent' as NodeId)).toEqual(['items', 'hidden'])
      expect(tree.getChildrenInProperty('parent' as NodeId, 'items')).toEqual(['child1', 'child2'])
      expect(tree.getChildrenInProperty('parent' as NodeId, 'hidden')).toEqual(['child3'])
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

  describe('getNodeType()', () => {
    it('should return the node type', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('node1' as NodeId, undefined, undefined, 'AstNode.Block')

      // Act & Assert
      expect(tree.getNodeType('node1' as NodeId)).toBe('AstNode.Block')
    })

    it('should return undefined for nodes without a type', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('node1' as NodeId)

      // Act & Assert
      expect(tree.getNodeType('node1' as NodeId)).toBeUndefined()
    })

    it('should return undefined for unknown nodes', () => {
      // Arrange
      const tree = new ASTNodeTree()

      // Act & Assert
      expect(tree.getNodeType('unknown' as NodeId)).toBeUndefined()
    })
  })

  describe('hasChildOfType()', () => {
    it('should return true when a child of the given type exists', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('parent' as NodeId)
      tree.addNode('child1' as NodeId, 'parent' as NodeId, 'items', 'AstNode.Block')
      tree.addNode('child2' as NodeId, 'parent' as NodeId, 'hidden', 'AstNode.Expression')

      // Act & Assert
      expect(tree.hasChildOfType('parent' as NodeId, 'AstNode.Block')).toBe(true)
      expect(tree.hasChildOfType('parent' as NodeId, 'AstNode.Expression')).toBe(true)
    })

    it('should return false when no child of the given type exists', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('parent' as NodeId)
      tree.addNode('child1' as NodeId, 'parent' as NodeId, 'hidden', 'AstNode.Expression')

      // Act & Assert
      expect(tree.hasChildOfType('parent' as NodeId, 'AstNode.Block')).toBe(false)
    })

    it('should return false for nodes without children', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('leaf' as NodeId)

      // Act & Assert
      expect(tree.hasChildOfType('leaf' as NodeId, 'AstNode.Block')).toBe(false)
    })
  })

  describe('hasDescendantOfType()', () => {
    it('should return true when a direct child has the type', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('parent' as NodeId)
      tree.addNode('child' as NodeId, 'parent' as NodeId, 'items', 'AstNode.Block')

      // Act & Assert
      expect(tree.hasDescendantOfType('parent' as NodeId, 'AstNode.Block')).toBe(true)
    })

    it('should return true when a grandchild has the type (iterate pattern)', () => {
      // Arrange — block → expression (iterate) → block (yield template)
      const tree = new ASTNodeTree()
      tree.addNode('block' as NodeId, undefined, undefined, 'AstNode.Block')
      tree.addNode('iterate' as NodeId, 'block' as NodeId, 'items', 'AstNode.Expression')
      tree.addNode('templateBlock' as NodeId, 'iterate' as NodeId, 'yield', 'AstNode.Block')

      // Act & Assert
      expect(tree.hasDescendantOfType('block' as NodeId, 'AstNode.Block')).toBe(true)
    })

    it('should return false when no descendant has the type', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('block' as NodeId, undefined, undefined, 'AstNode.Block')
      tree.addNode('expr1' as NodeId, 'block' as NodeId, 'hidden', 'AstNode.Expression')
      tree.addNode('expr2' as NodeId, 'block' as NodeId, 'label', 'AstNode.Expression')

      // Act & Assert
      expect(tree.hasDescendantOfType('block' as NodeId, 'AstNode.Block')).toBe(false)
    })

    it('should return false for leaf nodes', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('leaf' as NodeId)

      // Act & Assert
      expect(tree.hasDescendantOfType('leaf' as NodeId, 'AstNode.Block')).toBe(false)
    })

    it('should return true when a descendant has a template marker for the type', () => {
      // Arrange — block → expression (iterate), with template marker indicating blocks
      const tree = new ASTNodeTree()
      tree.addNode('block' as NodeId, undefined, undefined, 'AstNode.Block')
      tree.addNode('iterate' as NodeId, 'block' as NodeId, 'collection', 'AstNode.Expression')
      tree.markPropertyContainsType('iterate' as NodeId, 'yield', 'AstNode.Block')

      // Act & Assert
      expect(tree.hasDescendantOfType('block' as NodeId, 'AstNode.Block')).toBe(true)
    })
  })

  describe('getPropertyKeysWithChildType()', () => {
    it('should return property keys that contain children of the specified type', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('parent' as NodeId)
      tree.addNode('block1' as NodeId, 'parent' as NodeId, 'items', 'AstNode.Block')
      tree.addNode('block2' as NodeId, 'parent' as NodeId, 'footer', 'AstNode.Block')
      tree.addNode('expr1' as NodeId, 'parent' as NodeId, 'hidden', 'AstNode.Expression')

      // Act
      const blockKeys = tree.getPropertyKeysWithChildType('parent' as NodeId, 'AstNode.Block')

      // Assert
      expect(blockKeys).toEqual(['items', 'footer'])
    })

    it('should return empty array when no children of the type exist', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('parent' as NodeId)
      tree.addNode('expr1' as NodeId, 'parent' as NodeId, 'hidden', 'AstNode.Expression')

      // Act
      const result = tree.getPropertyKeysWithChildType('parent' as NodeId, 'AstNode.Block')

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('getChildrenInProperty()', () => {
    it('should return children under the specified property', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('parent' as NodeId)
      tree.addNode('child1' as NodeId, 'parent' as NodeId, 'items', 'AstNode.Block')
      tree.addNode('child2' as NodeId, 'parent' as NodeId, 'items', 'AstNode.Block')
      tree.addNode('child3' as NodeId, 'parent' as NodeId, 'other', 'AstNode.Expression')

      // Act
      const itemsChildren = tree.getChildrenInProperty('parent' as NodeId, 'items')

      // Assert
      expect(itemsChildren).toEqual(['child1', 'child2'])
    })

    it('should return empty array for unknown property key', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('parent' as NodeId)

      // Act & Assert
      expect(tree.getChildrenInProperty('parent' as NodeId, 'nonexistent')).toEqual([])
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

    it('should clone node types and property edges independently', () => {
      // Arrange
      const tree = new ASTNodeTree()
      tree.addNode('parent' as NodeId, undefined, undefined, 'AstNode.Block')
      tree.addNode('child' as NodeId, 'parent' as NodeId, 'items', 'AstNode.Block')

      // Act
      const cloned = tree.clone()
      cloned.addNode('newChild' as NodeId, 'parent' as NodeId, 'items', 'AstNode.Expression')

      // Assert
      expect(cloned.getChildrenInProperty('parent' as NodeId, 'items')).toEqual(['child', 'newChild'])
      expect(tree.getChildrenInProperty('parent' as NodeId, 'items')).toEqual(['child'])
      expect(cloned.getNodeType('parent' as NodeId)).toBe('AstNode.Block')
    })
  })
})
