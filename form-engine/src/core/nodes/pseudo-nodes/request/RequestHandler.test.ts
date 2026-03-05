import { createMockContext } from '@form-engine/test-utils/thunkTestHelpers'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import RequestHandler from './RequestHandler'

describe('RequestHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return the request URL', () => {
      // Arrange
      const pseudoNode = ASTTestFactory.requestPseudoNode('url')
      const handler = new RequestHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { url: 'https://example.test/forms/journey/step?tab=current' },
      })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBe('https://example.test/forms/journey/step?tab=current')
    })

    it('should derive the request path from an absolute URL', () => {
      // Arrange
      const pseudoNode = ASTTestFactory.requestPseudoNode('path')
      const handler = new RequestHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { url: 'https://example.test/forms/journey/step?tab=current#summary' },
      })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBe('/forms/journey/step')
    })

    it('should derive the request path from a relative URL fallback', () => {
      // Arrange
      const pseudoNode = ASTTestFactory.requestPseudoNode('path')
      const handler = new RequestHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { url: '/forms/journey/step?tab=current#summary' },
      })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBe('/forms/journey/step')
    })

    it('should return the request method', () => {
      // Arrange
      const pseudoNode = ASTTestFactory.requestPseudoNode('method')
      const handler = new RequestHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { method: 'POST' },
      })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBe('POST')
    })

    it('should return a header value for an exact key', () => {
      // Arrange
      const pseudoNode = ASTTestFactory.requestPseudoNode('headers.x-request-id')
      const handler = new RequestHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { headers: { 'x-request-id': 'abc-123' } },
      })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBe('abc-123')
    })

    it('should return a cookie value for an exact key', () => {
      // Arrange
      const pseudoNode = ASTTestFactory.requestPseudoNode('cookies.hmpps.session.id')
      const handler = new RequestHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { cookies: { 'hmpps.session.id': 'cookie-value' } },
      })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBe('cookie-value')
    })

    it('should return a state value for the base key', () => {
      // Arrange
      const pseudoNode = ASTTestFactory.requestPseudoNode('state.user')
      const handler = new RequestHandler(pseudoNode.id, pseudoNode)
      const user = { name: 'Alex', role: 'manager' }
      const mockContext = createMockContext({
        mockRequest: { state: { user } },
      })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toEqual(user)
    })

    it('should return undefined for missing keyed request values', () => {
      // Arrange
      const pseudoNode = ASTTestFactory.requestPseudoNode('headers.missing-header')
      const handler = new RequestHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext()

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it('should block dangerous keys for keyed request sources', () => {
      // Arrange
      const pseudoNode = ASTTestFactory.requestPseudoNode('state.__proto__')
      const handler = new RequestHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({
        mockRequest: { state: { __proto__: 'unsafe' } as Record<string, unknown> },
      })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeDefined()
    })
  })
})
