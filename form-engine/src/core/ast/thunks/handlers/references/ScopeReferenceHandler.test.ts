import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { createMockContext, createMockInvoker } from '@form-engine/test-utils/thunkTestHelpers'
import ScopeReferenceHandler from './ScopeReferenceHandler'

describe('ScopeReferenceHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return value from current scope level (0)', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['@scope', '0', 'name'])
      const handler = new ScopeReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockScope: [{ name: 'Current Item', id: 'item-1' }],
      })

      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('Current Item')
    })

    it('should return value from parent scope level (1)', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['@scope', '1', 'groupId'])
      const handler = new ScopeReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockScope: [
          { groupId: 'group-parent', name: 'Parent' },
          { itemId: 'item-current', name: 'Current' },
        ],
      })

      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('group-parent')
    })

    it('should return value from grandparent scope level (2)', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['@scope', '2', 'rootId'])
      const handler = new ScopeReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockScope: [
          { rootId: 'root-123', name: 'Grandparent' },
          { parentId: 'parent-456', name: 'Parent' },
          { childId: 'child-789', name: 'Current' },
        ],
      })

      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('root-123')
    })

    it('should handle numeric level index for scope access', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['@scope', '0', 'value'])
      const handler = new ScopeReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockScope: [{ value: 'numeric-index-value' }],
      })

      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('numeric-index-value')
    })

    it('should navigate nested path after scope resolution', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['@scope', '0', 'address', 'city'])
      const handler = new ScopeReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockScope: [
          {
            name: 'User',
            address: { city: 'London', postcode: 'SW1A 2AA' },
          },
        ],
      })

      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('London')
    })

    it('should navigate deeply nested paths', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['@scope', '0', 'config', 'settings', 'display', 'theme'])
      const handler = new ScopeReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockScope: [
          {
            config: {
              settings: {
                display: {
                  theme: 'dark',
                },
              },
            },
          },
        ],
      })

      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('dark')
    })

    it('should return entire scope object when no nested path provided', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['@scope', '0'])
      const handler = new ScopeReferenceHandler(referenceNode.id, referenceNode)

      const scopeItem = { id: 'item-1', name: 'Test Item' }

      const mockContext = createMockContext({
        mockScope: [scopeItem],
      })

      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toEqual(scopeItem)
    })

    it('should return undefined for non-existent nested path', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['@scope', '0', 'nonexistent', 'path'])
      const handler = new ScopeReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockScope: [{ name: 'Test' }],
      })

      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should return undefined when path is too short', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['@scope'])
      const handler = new ScopeReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockScope: [{ value: 'test' }],
      })

      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should return undefined when level index is not a valid number', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['@scope', 'invalid', 'name'])
      const handler = new ScopeReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockScope: [{ name: 'Test' }],
      })

      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should return undefined when scope level is out of bounds', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['@scope', '5', 'name'])
      const handler = new ScopeReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockScope: [{ name: 'Only One' }],
      })

      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should return undefined when scope is empty', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['@scope', '0', 'name'])
      const handler = new ScopeReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockScope: [],
      })

      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBeUndefined()
    })
  })
})
