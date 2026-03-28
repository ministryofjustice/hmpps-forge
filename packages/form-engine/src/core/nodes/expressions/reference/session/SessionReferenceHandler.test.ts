import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { createMockContext, createMockInvoker } from '@form-engine/test-utils/thunkTestHelpers'
import SessionReferenceHandler from './SessionReferenceHandler'

describe('SessionReferenceHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return value from pseudo node for Session()', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.sessionPseudoNode('user')
      const referenceNode = ASTTestFactory.reference(['session', 'user', 'name'])
      const handler = new SessionReferenceHandler(referenceNode.id, referenceNode)
      const mockContext = createMockContext({
        mockNodes: new Map([[pseudoNode.id, pseudoNode]]),
      })
      const invoker = createMockInvoker({
        returnValueMap: new Map([[pseudoNode.id, { name: 'Taylor', role: 'manager' }]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('Taylor')
    })

    it('should resolve Session() from the fallback session when no pseudo node exists', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['session', 'user', 'name'])
      const handler = new SessionReferenceHandler(referenceNode.id, referenceNode)
      const mockContext = createMockContext({
        mockRequest: {
          session: {
            user: { name: 'Jordan', role: 'caseworker' },
          },
        },
        mockNodes: new Map(),
      })
      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('Jordan')
    })

    it('should return undefined when the session key is missing', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['session', 'user', 'name'])
      const handler = new SessionReferenceHandler(referenceNode.id, referenceNode)
      const mockContext = createMockContext({
        mockRequest: {
          session: {
            account: { name: 'Caseworker' },
          },
        },
        mockNodes: new Map(),
      })
      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should return undefined for unsafe session keys when falling back', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['session', '__proto__'])
      const handler = new SessionReferenceHandler(referenceNode.id, referenceNode)
      const mockContext = createMockContext({
        mockRequest: {
          session: { __proto__: 'unsafe' } as Record<string, unknown>,
        },
        mockNodes: new Map(),
      })
      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBeUndefined()
    })
  })
})
