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

    it('should return @item when no nested path provided', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['@scope', '0'])
      const handler = new ScopeReferenceHandler(referenceNode.id, referenceNode)

      const originalItem = { id: 'item-1', name: 'Test Item' }

      const mockContext = createMockContext({
        mockScope: [{ ...originalItem, '@index': 0, '@item': originalItem }],
      })

      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toEqual(originalItem)
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

    describe('scope type tagging', () => {
      it('should skip predicate-type scopes when resolving iterator level 0', async () => {
        // Arrange - simulates Item().path('slug') inside Condition.Equals() within an iterator
        // Scope stack: [iterator scope, predicate scope]
        // Item() at level 0 should find the iterator scope, not the predicate scope
        const referenceNode = ASTTestFactory.reference(['@scope', '0', 'slug'])
        const handler = new ScopeReferenceHandler(referenceNode.id, referenceNode)

        const mockContext = createMockContext({
          mockScope: [
            { slug: 'accommodation', text: 'Accommodation', '@type': 'iterator', '@index': 0 },
            { '@value': 'some-value', '@type': 'predicate' },
          ],
        })

        const invoker = createMockInvoker()

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert - should get iterator scope, not predicate scope
        expect(result.value).toBe('accommodation')
      })

      it('should skip pipeline-type scopes when resolving iterator level 0', async () => {
        // Arrange - simulates Item().path('value') inside a transformer within an iterator
        const referenceNode = ASTTestFactory.reference(['@scope', '0', 'value'])
        const handler = new ScopeReferenceHandler(referenceNode.id, referenceNode)

        const mockContext = createMockContext({
          mockScope: [
            { value: 'iterator-value', '@type': 'iterator', '@index': 0 },
            { '@value': 'pipeline-value', '@type': 'pipeline' },
          ],
        })

        const invoker = createMockInvoker()

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value).toBe('iterator-value')
      })

      it('should correctly resolve nested iterator levels with predicate scope in between', async () => {
        // Arrange - simulates Item().parent.path('name') inside a nested iterator's predicate
        // Scope stack: [outer iterator, inner iterator, predicate scope]
        const referenceNode = ASTTestFactory.reference(['@scope', '1', 'name'])
        const handler = new ScopeReferenceHandler(referenceNode.id, referenceNode)

        const mockContext = createMockContext({
          mockScope: [
            { name: 'Outer Department', '@type': 'iterator', '@index': 0 },
            { name: 'Inner Employee', '@type': 'iterator', '@index': 0 },
            { '@value': true, '@type': 'predicate' },
          ],
        })

        const invoker = createMockInvoker()

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert - level 1 should be outer iterator, skipping predicate
        expect(result.value).toBe('Outer Department')
      })

      it('should handle multiple predicate scopes between iterator scopes', async () => {
        // Arrange - deeply nested predicates
        const referenceNode = ASTTestFactory.reference(['@scope', '0', 'id'])
        const handler = new ScopeReferenceHandler(referenceNode.id, referenceNode)

        const mockContext = createMockContext({
          mockScope: [
            { id: 'iterator-item', '@type': 'iterator', '@index': 0 },
            { '@value': 'predicate-1', '@type': 'predicate' },
            { '@value': 'predicate-2', '@type': 'predicate' },
          ],
        })

        const invoker = createMockInvoker()

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value).toBe('iterator-item')
      })

      it('should maintain backwards compatibility with untagged scopes', async () => {
        // Arrange - untagged scopes should be treated as iterator scopes
        const referenceNode = ASTTestFactory.reference(['@scope', '0', 'name'])
        const handler = new ScopeReferenceHandler(referenceNode.id, referenceNode)

        const mockContext = createMockContext({
          mockScope: [
            { name: 'Untagged Item' }, // No @type - treated as iterator
          ],
        })

        const invoker = createMockInvoker()

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value).toBe('Untagged Item')
      })

      it('should return undefined when all scopes are non-iterator type', async () => {
        // Arrange
        const referenceNode = ASTTestFactory.reference(['@scope', '0', 'name'])
        const handler = new ScopeReferenceHandler(referenceNode.id, referenceNode)

        const mockContext = createMockContext({
          mockScope: [
            { '@value': 'predicate-value', '@type': 'predicate' },
            { '@value': 'pipeline-value', '@type': 'pipeline' },
          ],
        })

        const invoker = createMockInvoker()

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value).toBeUndefined()
      })
    })
  })
})
