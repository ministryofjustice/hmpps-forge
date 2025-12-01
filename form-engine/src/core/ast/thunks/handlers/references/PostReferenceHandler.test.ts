import { ExpressionType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createMockInvokerWithError,
} from '@form-engine/test-utils/thunkTestHelpers'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { NodeId } from '@form-engine/core/types/engine.type'
import PostReferenceHandler from './PostReferenceHandler'

describe('PostReferenceHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return value from pseudo node for static simple reference', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.postPseudoNode('businessName')
      const referenceNode = ASTTestFactory.reference(['post', 'businessName'])
      const handler = new PostReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockNodes: new Map([[pseudoNode.id, pseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([[pseudoNode.id, 'Acme Corp']]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('Acme Corp')
    })

    it('should navigate nested path after pseudo node resolution for static reference', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['post', 'address', 'city'])
      const pseudoNode = ASTTestFactory.postPseudoNode('address')
      const handler = new PostReferenceHandler(referenceNode.id, referenceNode)

      const addressValue = {
        line1: '123 Main St',
        city: 'Birmingham',
        postcode: 'B1 1AA',
      }

      const mockContext = createMockContext({
        mockNodes: new Map([[pseudoNode.id, pseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([[pseudoNode.id, addressValue]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('Birmingham')
    })

    it('should navigate deeply nested paths for static reference', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['post', 'applicant', 'contact', 'phone', 'mobile'])
      const pseudoNode = ASTTestFactory.postPseudoNode('applicant')
      const handler = new PostReferenceHandler(referenceNode.id, referenceNode)

      const applicantValue = {
        contact: {
          phone: {
            mobile: '07700900000',
          },
        },
      }

      const mockContext = createMockContext({
        mockNodes: new Map([[pseudoNode.id, pseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([[pseudoNode.id, applicantValue]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('07700900000')
    })

    it('should fallback to context.request.post when no pseudo node exists', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['post', 'legacyField'])
      const handler = new PostReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockRequest: { post: { legacyField: 'legacy-value' } },
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
      const referenceNode = ASTTestFactory.reference(['post', 'form', 'section', 'value'])
      const handler = new PostReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockRequest: {
          post: {
            form: {
              section: {
                value: 'nested-value',
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
      expect(result.value).toBe('nested-value')
    })

    it('should return undefined for non-existent nested path with static reference', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['post', 'address', 'nonexistent', 'path'])
      const pseudoNode = ASTTestFactory.postPseudoNode('address')
      const handler = new PostReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockNodes: new Map([[pseudoNode.id, pseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([[pseudoNode.id, { city: 'London' }]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should resolve dynamic field code from AST node', async () => {
      // Arrange
      const dynamicKeyNode = ASTTestFactory.reference(['answers', 'selectedField'])
      const referenceNode = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['post', dynamicKeyNode])
        .build()

      const emailPseudoNode = ASTTestFactory.postPseudoNode('email')
      const handler = new PostReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockNodes: new Map([[emailPseudoNode.id, emailPseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([
          [dynamicKeyNode.id, 'email'],
          [emailPseudoNode.id, 'user@example.com'],
        ]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('user@example.com')
    })

    it('should split dynamic path with dots into segments', async () => {
      // Arrange
      const dynamicKeyNode = ASTTestFactory.reference(['answers', 'fieldPath'])
      const referenceNode = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['post', dynamicKeyNode])
        .build()

      const contactPseudoNode = ASTTestFactory.postPseudoNode('contact')
      const handler = new PostReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockNodes: new Map([[contactPseudoNode.id, contactPseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map<NodeId, unknown>([
          [dynamicKeyNode.id, 'contact.details.email'],
          [contactPseudoNode.id, { details: { email: 'test@example.com' } }],
        ]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('test@example.com')
    })

    it('should return undefined when dynamic evaluation returns error', async () => {
      // Arrange
      const dynamicKeyNode = ASTTestFactory.reference(['answers', 'selectedField'])
      const referenceNode = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['post', dynamicKeyNode])
        .build()

      const handler = new PostReferenceHandler(referenceNode.id, referenceNode)
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
        .withPath(['post', dynamicKeyNode])
        .build()

      const handler = new PostReferenceHandler(referenceNode.id, referenceNode)
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
