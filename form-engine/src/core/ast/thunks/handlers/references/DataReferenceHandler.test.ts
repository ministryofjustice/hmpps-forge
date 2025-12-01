import { ExpressionType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createMockInvokerWithError,
} from '@form-engine/test-utils/thunkTestHelpers'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { NodeId } from '@form-engine/core/types/engine.type'
import DataReferenceHandler from './DataReferenceHandler'

describe('DataReferenceHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return value from pseudo node for static simple reference', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.dataPseudoNode('userId')
      const referenceNode = ASTTestFactory.reference(['data', 'userId'])
      const handler = new DataReferenceHandler(referenceNode.id, referenceNode)

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
      const referenceNode = ASTTestFactory.reference(['data', 'user', 'name'])
      const pseudoNode = ASTTestFactory.dataPseudoNode('user')
      const handler = new DataReferenceHandler(referenceNode.id, referenceNode)

      const userData = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
      }

      const mockContext = createMockContext({
        mockNodes: new Map([[pseudoNode.id, pseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([[pseudoNode.id, userData]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('John Doe')
    })

    it('should navigate deeply nested paths for static reference', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['data', 'organisation', 'settings', 'permissions', 'admin'])
      const pseudoNode = ASTTestFactory.dataPseudoNode('organisation')
      const handler = new DataReferenceHandler(referenceNode.id, referenceNode)

      const orgData = {
        settings: {
          permissions: {
            admin: true,
          },
        },
      }

      const mockContext = createMockContext({
        mockNodes: new Map([[pseudoNode.id, pseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([[pseudoNode.id, orgData]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe(true)
    })

    it('should fallback to context.global.data when no pseudo node exists', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['data', 'legacyData'])
      const handler = new DataReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockData: { legacyData: 'legacy-value' },
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
      const referenceNode = ASTTestFactory.reference(['data', 'config', 'features', 'enabled'])
      const handler = new DataReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockData: {
          config: {
            features: {
              enabled: true,
            },
          },
        },
        mockNodes: new Map(),
      })

      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe(true)
    })

    it('should return undefined for non-existent nested path with static reference', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['data', 'user', 'nonexistent', 'path'])
      const pseudoNode = ASTTestFactory.dataPseudoNode('user')
      const handler = new DataReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockNodes: new Map([[pseudoNode.id, pseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([[pseudoNode.id, { name: 'John' }]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should resolve dynamic field key from AST node', async () => {
      // Arrange
      const dynamicKeyNode = ASTTestFactory.reference(['answers', 'selectedDataSource'])
      const referenceNode = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['data', dynamicKeyNode])
        .build()

      const userPseudoNode = ASTTestFactory.dataPseudoNode('user')
      const handler = new DataReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockNodes: new Map([[userPseudoNode.id, userPseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map<NodeId, unknown>([
          [dynamicKeyNode.id, 'user'],
          [userPseudoNode.id, { id: 'user-456' }],
        ]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toEqual({ id: 'user-456' })
    })

    it('should split dynamic path with dots into segments', async () => {
      // Arrange
      const dynamicKeyNode = ASTTestFactory.reference(['answers', 'dataPath'])
      const referenceNode = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['data', dynamicKeyNode])
        .build()

      const orgPseudoNode = ASTTestFactory.dataPseudoNode('organisation')
      const handler = new DataReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockNodes: new Map([[orgPseudoNode.id, orgPseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map<NodeId, unknown>([
          [dynamicKeyNode.id, 'organisation.address.city'],
          [orgPseudoNode.id, { address: { city: 'Manchester' } }],
        ]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('Manchester')
    })

    it('should return undefined when dynamic evaluation returns error', async () => {
      // Arrange
      const dynamicKeyNode = ASTTestFactory.reference(['answers', 'selectedDataSource'])
      const referenceNode = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['data', dynamicKeyNode])
        .build()

      const handler = new DataReferenceHandler(referenceNode.id, referenceNode)
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
        .withPath(['data', dynamicKeyNode])
        .build()

      const handler = new DataReferenceHandler(referenceNode.id, referenceNode)
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
