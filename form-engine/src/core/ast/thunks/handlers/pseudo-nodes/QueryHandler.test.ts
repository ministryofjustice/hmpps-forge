import QueryHandler from '@form-engine/core/ast/thunks/handlers/pseudo-nodes/QueryHandler'
import { createMockContext } from '@form-engine/test-utils/thunkTestHelpers'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'

describe('QueryHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return query parameter value for existing parameter', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.queryPseudoNode('returnUrl')
      const handler = new QueryHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { query: { returnUrl: '/dashboard' } },
      })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBe('/dashboard')
      expect(result.error).toBeUndefined()
    })

    it('should return undefined for non-existent parameter', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.queryPseudoNode('missingParam')
      const handler = new QueryHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { query: { returnUrl: '/dashboard' } },
      })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it('should return string array for multi-value query parameters', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.queryPseudoNode('tags')
      const handler = new QueryHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { query: { tags: ['urgent', 'important', 'review'] } },
      })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toEqual(['urgent', 'important', 'review'])
      expect(Array.isArray(result.value)).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should handle empty string values', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.queryPseudoNode('search')
      const handler = new QueryHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { query: { search: '' } },
      })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBe('')
      expect(result.error).toBeUndefined()
    })

    it('should handle URL-encoded values correctly', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.queryPseudoNode('message')
      const handler = new QueryHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { query: { message: 'Hello World!' } },
      })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBe('Hello World!')
      expect(result.error).toBeUndefined()
    })

    it('should store nodeId correctly', () => {
      // Arrange
      const pseudoNode = ASTTestFactory.queryPseudoNode('test')

      // Act
      const handler = new QueryHandler(pseudoNode.id, pseudoNode)

      // Assert
      expect(handler.nodeId).toBe(pseudoNode.id)
    })
  })
})
