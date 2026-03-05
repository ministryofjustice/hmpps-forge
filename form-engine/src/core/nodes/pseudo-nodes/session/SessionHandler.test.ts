import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { createMockContext } from '@form-engine/test-utils/thunkTestHelpers'
import SessionHandler from './SessionHandler'

describe('SessionHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return the base session value', () => {
      // Arrange
      const pseudoNode = ASTTestFactory.sessionPseudoNode('user')
      const handler = new SessionHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: {
          session: {
            user: { name: 'Alex', role: 'manager' },
          },
        },
      })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toEqual({ name: 'Alex', role: 'manager' })
    })

    it('should return undefined when the session is missing', () => {
      // Arrange
      const pseudoNode = ASTTestFactory.sessionPseudoNode('user')
      const handler = new SessionHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext()

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it('should block dangerous keys', () => {
      // Arrange
      const pseudoNode = ASTTestFactory.sessionPseudoNode('__proto__')
      const handler = new SessionHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: {
          session: { __proto__: 'unsafe' } as Record<string, unknown>,
        },
      })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeDefined()
    })
  })
})
