import { ExpressionType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createMockInvokerWithError,
} from '@form-engine/test-utils/thunkTestHelpers'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { NodeId } from '@form-engine/core/types/engine.type'
import QueryReferenceHandler from './QueryReferenceHandler'

describe('QueryReferenceHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return value from pseudo node for static simple reference', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.queryPseudoNode('returnUrl')
      const referenceNode = ASTTestFactory.reference(['query', 'returnUrl'])
      const handler = new QueryReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockNodes: new Map([[pseudoNode.id, pseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([[pseudoNode.id, '/dashboard']]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('/dashboard')
    })

    it('should navigate nested path after pseudo node resolution for static reference', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['query', 'filter', 'type'])
      const pseudoNode = ASTTestFactory.queryPseudoNode('filter')
      const handler = new QueryReferenceHandler(referenceNode.id, referenceNode)

      const filterValue = {
        type: 'active',
        sortBy: 'date',
      }

      const mockContext = createMockContext({
        mockNodes: new Map([[pseudoNode.id, pseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([[pseudoNode.id, filterValue]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('active')
    })

    it('should navigate deeply nested paths for static reference', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['query', 'options', 'display', 'theme', 'mode'])
      const pseudoNode = ASTTestFactory.queryPseudoNode('options')
      const handler = new QueryReferenceHandler(referenceNode.id, referenceNode)

      const optionsValue = {
        display: {
          theme: {
            mode: 'dark',
          },
        },
      }

      const mockContext = createMockContext({
        mockNodes: new Map([[pseudoNode.id, pseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([[pseudoNode.id, optionsValue]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('dark')
    })

    it('should fallback to context.request.query when no pseudo node exists', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['query', 'legacyParam'])
      const handler = new QueryReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockRequest: { query: { legacyParam: 'legacy-value' } },
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
      const referenceNode = ASTTestFactory.reference(['query', 'pagination', 'page', 'current'])
      const handler = new QueryReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockRequest: {
          query: {
            pagination: {
              page: {
                current: 5,
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
      expect(result.value).toBe(5)
    })

    it('should return undefined for non-existent nested path with static reference', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['query', 'filter', 'nonexistent', 'path'])
      const pseudoNode = ASTTestFactory.queryPseudoNode('filter')
      const handler = new QueryReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockNodes: new Map([[pseudoNode.id, pseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([[pseudoNode.id, { type: 'active' }]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should resolve dynamic param name from AST node', async () => {
      // Arrange
      const dynamicKeyNode = ASTTestFactory.reference(['answers', 'selectedParam'])
      const referenceNode = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['query', dynamicKeyNode])
        .build()

      const redirectPseudoNode = ASTTestFactory.queryPseudoNode('redirect')
      const handler = new QueryReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockNodes: new Map([[redirectPseudoNode.id, redirectPseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([
          [dynamicKeyNode.id, 'redirect'],
          [redirectPseudoNode.id, '/home'],
        ]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('/home')
    })

    it('should split dynamic path with dots into segments', async () => {
      // Arrange
      const dynamicKeyNode = ASTTestFactory.reference(['answers', 'queryPath'])
      const referenceNode = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['query', dynamicKeyNode])
        .build()

      const filterPseudoNode = ASTTestFactory.queryPseudoNode('filter')
      const handler = new QueryReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockNodes: new Map([[filterPseudoNode.id, filterPseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map<NodeId, unknown>([
          [dynamicKeyNode.id, 'filter.options.sortBy'],
          [filterPseudoNode.id, { options: { sortBy: 'name' } }],
        ]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('name')
    })

    it('should return undefined when dynamic evaluation returns error', async () => {
      // Arrange
      const dynamicKeyNode = ASTTestFactory.reference(['answers', 'selectedParam'])
      const referenceNode = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['query', dynamicKeyNode])
        .build()

      const handler = new QueryReferenceHandler(referenceNode.id, referenceNode)
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
        .withPath(['query', dynamicKeyNode])
        .build()

      const handler = new QueryReferenceHandler(referenceNode.id, referenceNode)
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
