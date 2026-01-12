import { ExpressionType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createMockInvokerWithError,
} from '@form-engine/test-utils/thunkTestHelpers'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { NodeId } from '@form-engine/core/types/engine.type'
import AnswersReferenceHandler from './AnswersReferenceHandler'

describe('AnswersReferenceHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return value from pseudo node for static simple reference', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('businessType')
      const referenceNode = ASTTestFactory.reference(['answers', 'businessType'])
      const handler = new AnswersReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockNodes: new Map([[pseudoNode.id, pseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([[pseudoNode.id, 'food-stall']]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('food-stall')
    })

    it('should navigate nested path after pseudo node resolution for static reference', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['answers', 'address', 'city'])
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('address')
      const handler = new AnswersReferenceHandler(referenceNode.id, referenceNode)

      const addressValue = {
        line1: '10 Downing Street',
        city: 'London',
        postcode: 'SW1A 2AA',
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
      expect(result.value).toBe('London')
    })

    it('should navigate deeply nested paths for static reference', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['answers', 'user', 'profile', 'settings', 'theme'])
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('user')
      const handler = new AnswersReferenceHandler(referenceNode.id, referenceNode)

      const userValue = {
        profile: {
          settings: {
            theme: 'dark',
          },
        },
      }

      const mockContext = createMockContext({
        mockNodes: new Map([[pseudoNode.id, pseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([[pseudoNode.id, userValue]]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('dark')
    })

    it('should fallback to context.global.answers when no pseudo node exists', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['answers', 'legacyField'])
      const handler = new AnswersReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockAnswers: { legacyField: 'legacy-value' },
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
      const referenceNode = ASTTestFactory.reference(['answers', 'config', 'settings', 'enabled'])
      const handler = new AnswersReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockAnswers: {
          config: {
            settings: {
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
      const referenceNode = ASTTestFactory.reference(['answers', 'address', 'nonexistent', 'path'])
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('address')
      const handler = new AnswersReferenceHandler(referenceNode.id, referenceNode)

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

    it('should resolve dynamic field key from AST node', async () => {
      // Arrange
      const dynamicKeyNode = ASTTestFactory.reference(['answers', 'preferredContactMethod'])
      const referenceNode = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['answers', dynamicKeyNode])
        .build()

      const emailPseudoNode = ASTTestFactory.answerLocalPseudoNode('email')
      const handler = new AnswersReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockNodes: new Map([[emailPseudoNode.id, emailPseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map([
          [dynamicKeyNode.id, 'email'],
          [emailPseudoNode.id, 'test@example.com'],
        ]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('test@example.com')
    })

    it('should split dynamic path with dots into segments', async () => {
      // Arrange
      const dynamicKeyNode = ASTTestFactory.reference(['data', 'fieldToValidate'])
      const referenceNode = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['answers', dynamicKeyNode])
        .build()

      const applicantPseudoNode = ASTTestFactory.answerLocalPseudoNode('applicant')
      const handler = new AnswersReferenceHandler(referenceNode.id, referenceNode)

      const mockContext = createMockContext({
        mockNodes: new Map([[applicantPseudoNode.id, applicantPseudoNode]]),
      })

      const invoker = createMockInvoker({
        returnValueMap: new Map<NodeId, unknown>([
          [dynamicKeyNode.id, 'applicant.address.city'],
          [applicantPseudoNode.id, { address: { city: 'London' } }],
        ]),
      })

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toBe('London')
    })

    it('should return undefined when dynamic evaluation returns error', async () => {
      // Arrange
      const dynamicKeyNode = ASTTestFactory.reference(['answers', 'preferredContactMethod'])
      const referenceNode = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['answers', dynamicKeyNode])
        .build()

      const handler = new AnswersReferenceHandler(referenceNode.id, referenceNode)
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
        .withPath(['answers', dynamicKeyNode])
        .build()

      const handler = new AnswersReferenceHandler(referenceNode.id, referenceNode)
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
