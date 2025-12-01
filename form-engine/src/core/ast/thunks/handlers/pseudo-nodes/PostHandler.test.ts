import PostHandler from '@form-engine/core/ast/thunks/handlers/pseudo-nodes/PostHandler'
import { createMockContext } from '@form-engine/test-utils/thunkTestHelpers'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'

describe('PostHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return POST value for existing field', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.postPseudoNode('email')
      const handler = new PostHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { post: { email: 'user@example.com' } },
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toBe('user@example.com')
      expect(result.error).toBeUndefined()
    })

    it('should return undefined for non-existent field', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.postPseudoNode('missingField')
      const handler = new PostHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { post: { email: 'user@example.com' } },
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it('should return string array for multi-value fields', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.postPseudoNode('interests')
      const handler = new PostHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { post: { interests: ['coding', 'reading', 'gaming'] } },
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toEqual(['coding', 'reading', 'gaming'])
      expect(Array.isArray(result.value)).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should return raw unformatted value', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.postPseudoNode('name')
      const handler = new PostHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { post: { name: '  JOHN DOE  ' } },
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toBe('  JOHN DOE  ')
      expect(result.error).toBeUndefined()
    })

    it('should handle empty string values', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.postPseudoNode('optionalField')
      const handler = new PostHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { post: { optionalField: '' } },
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toBe('')
      expect(result.error).toBeUndefined()
    })

    it('should store nodeId correctly', () => {
      // Arrange
      const pseudoNode = ASTTestFactory.postPseudoNode('test')

      // Act
      const handler = new PostHandler(pseudoNode.id, pseudoNode)

      // Assert
      expect(handler.nodeId).toBe(pseudoNode.id)
    })
  })
})
