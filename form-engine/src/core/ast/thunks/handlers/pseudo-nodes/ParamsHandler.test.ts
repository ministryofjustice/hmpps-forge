import ParamsHandler from '@form-engine/core/ast/thunks/handlers/pseudo-nodes/ParamsHandler'
import { createMockContext } from '@form-engine/test-utils/thunkTestHelpers'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'

describe('ParamsHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return route parameter value for existing parameter', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.paramsPseudoNode('userId')
      const handler = new ParamsHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { params: { userId: '12345' } },
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toBe('12345')
      expect(result.error).toBeUndefined()
    })

    it('should return undefined for non-existent parameter', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.paramsPseudoNode('missingParam')
      const handler = new ParamsHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { params: { userId: '12345' } },
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it('should handle URL-encoded parameter values', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.paramsPseudoNode('prisonNumber')
      const handler = new ParamsHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { params: { prisonNumber: 'A1234BC' } },
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toBe('A1234BC')
      expect(result.error).toBeUndefined()
    })

    it('should handle numeric-looking parameter values as strings', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.paramsPseudoNode('journeyId')
      const handler = new ParamsHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { params: { journeyId: '999' } },
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toBe('999')
      expect(typeof result.value).toBe('string')
      expect(result.error).toBeUndefined()
    })

    it('should handle UUID parameter values', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.paramsPseudoNode('assessmentId')
      const handler = new ParamsHandler(pseudoNode.id, pseudoNode)
      const uuid = '550e8400-e29b-41d4-a716-446655440000'
      const mockContext = createMockContext({
        mockRequest: { params: { assessmentId: uuid } },
      })

      // Act
      const result = await handler.evaluate(mockContext)

      // Assert
      expect(result.value).toBe(uuid)
      expect(result.error).toBeUndefined()
    })

    it('should store nodeId correctly', () => {
      // Arrange
      const pseudoNode = ASTTestFactory.paramsPseudoNode('test')

      // Act
      const handler = new ParamsHandler(pseudoNode.id, pseudoNode)

      // Assert
      expect(handler.nodeId).toBe(pseudoNode.id)
    })
  })
})
