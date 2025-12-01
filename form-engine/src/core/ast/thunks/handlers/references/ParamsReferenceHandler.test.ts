import { ExpressionType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createMockInvokerWithError,
} from '@form-engine/test-utils/thunkTestHelpers'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { NodeId } from '@form-engine/core/types/engine.type'
import ParamsReferenceHandler from './ParamsReferenceHandler'

describe('ParamsReferenceHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return value from pseudo node for static simple reference', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.paramsPseudoNode('userId')
      const referenceNode = ASTTestFactory.reference(['params', 'userId'])
      const handler = new ParamsReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockNodes: new Map([[pseudoNode.id, pseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([[pseudoNode.id, 'user-123']]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('user-123')
    })

    it('should navigate nested path after pseudo node resolution for static reference', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['params', 'resource', 'id'])
      const pseudoNode = ASTTestFactory.paramsPseudoNode('resource')
      const handler = new ParamsReferenceHandler(referenceNode.id, referenceNode)

      const resourceData = {
        id: 'res-456',
        type: 'document',
        name: 'Report.pdf',
      }

      const mockContext = createMockContext({
        mockNodes: new Map([[pseudoNode.id, pseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([[pseudoNode.id, resourceData]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('res-456')
    })

    it('should navigate deeply nested paths for static reference', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['params', 'route', 'segment', 'nested', 'value'])
      const pseudoNode = ASTTestFactory.paramsPseudoNode('route')
      const handler = new ParamsReferenceHandler(referenceNode.id, referenceNode)

      const routeData = {
        segment: {
          nested: {
            value: 'deep-value',
          },
        },
      }

      const mockContext = createMockContext({
        mockNodes: new Map([[pseudoNode.id, pseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([[pseudoNode.id, routeData]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('deep-value')
    })

    it('should fallback to context.request.params when no pseudo node exists', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['params', 'legacyParam'])
      const handler = new ParamsReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockRequest: { params: { legacyParam: 'legacy-value' } },
        mockNodes: new Map(),
      })

      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('legacy-value')
      expect(invoker.invoke).not.toHaveBeenCalled()
    })

    it('should fallback to context and navigate nested path for static reference', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['params', 'config', 'section', 'id'])
      const handler = new ParamsReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockRequest: {
          params: {
            config: {
              section: {
                id: 'section-123',
              },
            },
          } as any,
        },
        mockNodes: new Map(),
      })

      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('section-123')
    })

    it('should return undefined for non-existent nested path with static reference', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['params', 'resource', 'nonexistent', 'path'])
      const pseudoNode = ASTTestFactory.paramsPseudoNode('resource')
      const handler = new ParamsReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockNodes: new Map([[pseudoNode.id, pseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([[pseudoNode.id, { id: 'res-123' }]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should resolve dynamic param key from AST node', async () => {
      // Arrange
      const dynamicKeyNode = ASTTestFactory.reference(['answers', 'selectedParam'])
      const referenceNode = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['params', dynamicKeyNode])
        .build()

      const userIdPseudoNode = ASTTestFactory.paramsPseudoNode('userId')
      const handler = new ParamsReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockNodes: new Map([[userIdPseudoNode.id, userIdPseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([
          [dynamicKeyNode.id, 'userId'],
          [userIdPseudoNode.id, 'user-789'],
        ]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('user-789')
    })

    it('should split dynamic path with dots into segments', async () => {
      // Arrange
      const dynamicKeyNode = ASTTestFactory.reference(['answers', 'paramPath'])
      const referenceNode = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['params', dynamicKeyNode])
        .build()

      const routePseudoNode = ASTTestFactory.paramsPseudoNode('route')
      const handler = new ParamsReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockNodes: new Map([[routePseudoNode.id, routePseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map<NodeId, unknown>([
          [dynamicKeyNode.id, 'route.segment.id'],
          [routePseudoNode.id, { segment: { id: 'seg-456' } }],
        ]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('seg-456')
    })

    it('should return undefined when dynamic evaluation returns error', async () => {
      // Arrange
      const dynamicKeyNode = ASTTestFactory.reference(['answers', 'selectedParam'])
      const referenceNode = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['params', dynamicKeyNode])
        .build()

      const handler = new ParamsReferenceHandler(referenceNode.id, referenceNode)
      const mockContext = createMockContext()
      const invoker = createMockInvokerWithError({ message: 'Failed' })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should return undefined when dynamic evaluation returns non-string', async () => {
      // Arrange
      const dynamicKeyNode = ASTTestFactory.reference(['answers', 'selectedIndex'])
      const referenceNode = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['params', dynamicKeyNode])
        .build()

      const handler = new ParamsReferenceHandler(referenceNode.id, referenceNode)
      const mockContext = createMockContext()

      const invoker = createMockInvoker({
        invokeImpl: async () => ({
          value: 42,
          metadata: { source: 'test', timestamp: Date.now() },
        }),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBeUndefined()
    })
  })
})
