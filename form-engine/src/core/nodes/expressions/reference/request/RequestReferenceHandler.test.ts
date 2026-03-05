import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { createMockContext, createMockInvoker } from '@form-engine/test-utils/thunkTestHelpers'
import RequestReferenceHandler from './RequestReferenceHandler'

describe('RequestReferenceHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return value from pseudo node for Request.Url()', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.requestPseudoNode('url')
      const referenceNode = ASTTestFactory.reference(['request', 'url'])
      const handler = new RequestReferenceHandler(referenceNode.id, referenceNode)
      const mockContext = createMockContext({
        mockNodes: new Map([[pseudoNode.id, pseudoNode]]),
      })
      const invoker = createMockInvoker({
        returnValueMap: new Map([[pseudoNode.id, 'https://example.test/forms/current?tab=future']]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('https://example.test/forms/current?tab=future')
    })

    it('should derive Request.Path() from the fallback request URL when no pseudo node exists', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['request', 'path'])
      const handler = new RequestReferenceHandler(referenceNode.id, referenceNode)
      const mockContext = createMockContext({
        mockRequest: { url: '/forms/current?tab=future#summary' },
        mockNodes: new Map(),
      })
      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('/forms/current')
    })

    it('should resolve Request.Method()', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['request', 'method'])
      const handler = new RequestReferenceHandler(referenceNode.id, referenceNode)
      const mockContext = createMockContext({
        mockRequest: { method: 'POST' },
        mockNodes: new Map(),
      })
      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('POST')
    })

    it('should resolve Request.Headers() using the exact key', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['request', 'headers', 'x.request.id'])
      const handler = new RequestReferenceHandler(referenceNode.id, referenceNode)
      const mockContext = createMockContext({
        mockRequest: { headers: { 'x.request.id': 'req-1' } },
        mockNodes: new Map(),
      })
      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('req-1')
    })

    it('should resolve Request.Cookies() using the exact key', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['request', 'cookies', 'hmpps.session.id'])
      const handler = new RequestReferenceHandler(referenceNode.id, referenceNode)
      const mockContext = createMockContext({
        mockRequest: { cookies: { 'hmpps.session.id': 'cookie-1' } },
        mockNodes: new Map(),
      })
      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('cookie-1')
    })

    it('should resolve Request.State() and navigate nested path', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['request', 'state', 'user', 'name'])
      const pseudoNode = ASTTestFactory.requestPseudoNode('state.user')
      const handler = new RequestReferenceHandler(referenceNode.id, referenceNode)
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

    it('should access array values from Request.Headers()', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['request', 'headers', 'x-forwarded-for', '0'])
      const handler = new RequestReferenceHandler(referenceNode.id, referenceNode)
      const mockContext = createMockContext({
        mockRequest: { headers: { 'x-forwarded-for': ['10.0.0.1', '10.0.0.2'] } },
        mockNodes: new Map(),
      })
      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('10.0.0.1')
    })

    it('should return undefined for malformed request references', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['request', 'headers'])
      const handler = new RequestReferenceHandler(referenceNode.id, referenceNode)
      const mockContext = createMockContext({ mockNodes: new Map() })
      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBeUndefined()
    })
  })
})
