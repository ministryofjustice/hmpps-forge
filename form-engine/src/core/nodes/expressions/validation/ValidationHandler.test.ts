import { ExpressionType, PredicateType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createMockInvokerWithError,
} from '@form-engine/test-utils/thunkTestHelpers'
import { ThunkResult } from '@form-engine/core/compilation/thunks/types'
import { ValidationASTNode } from '@form-engine/core/types/expressions.type'
import { NodeId } from '@form-engine/core/types/engine.type'
import ValidationHandler from './ValidationHandler'

describe('ValidationHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate', () => {
    it('should return passed false when predicate is truthy', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const validation = ASTTestFactory.expression(ExpressionType.VALIDATION)
        .withProperty('when', predicateNode)
        .withProperty('message', 'Field is required')
        .build() as ValidationASTNode
      const handler = new ValidationHandler(validation.id, validation)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: true })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.passed).toBe(false)
      expect(result.value?.message).toBe('Field is required')
    })

    it('should return passed true when predicate is falsy', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const validation = ASTTestFactory.expression(ExpressionType.VALIDATION)
        .withProperty('when', predicateNode)
        .withProperty('message', 'Field is required')
        .build() as ValidationASTNode
      const handler = new ValidationHandler(validation.id, validation)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: false })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.passed).toBe(true)
      expect(result.value?.message).toBe('Field is required')
    })

    it('should evaluate message when it is an AST node', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const messageNode = ASTTestFactory.reference(['data', 'errorMessage'])
      const validation = ASTTestFactory.expression(ExpressionType.VALIDATION)
        .withProperty('when', predicateNode)
        .withProperty('message', messageNode)
        .build() as ValidationASTNode
      const handler = new ValidationHandler(validation.id, validation)
      const mockContext = createMockContext()
      const returnValues = new Map<NodeId, unknown>([
        [predicateNode.id, true],
        [messageNode.id, 'Dynamic error message'],
      ])
      const mockInvoker = createMockInvoker({ returnValueMap: returnValues })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.message).toBe('Dynamic error message')
    })

    it('should pass through submissionOnly flag', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const validation = ASTTestFactory.expression(ExpressionType.VALIDATION)
        .withProperty('when', predicateNode)
        .withProperty('message', 'Field is required')
        .withProperty('submissionOnly', true)
        .build() as ValidationASTNode
      const handler = new ValidationHandler(validation.id, validation)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: true })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.submissionOnly).toBe(true)
    })

    it('should default submissionOnly to false when not specified', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const validation = ASTTestFactory.expression(ExpressionType.VALIDATION)
        .withProperty('when', predicateNode)
        .withProperty('message', 'Field is required')
        .build() as ValidationASTNode
      const handler = new ValidationHandler(validation.id, validation)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: true })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.submissionOnly).toBe(false)
    })

    it('should pass through details object', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const details = { minLength: 5, maxLength: 100 }
      const validation = ASTTestFactory.expression(ExpressionType.VALIDATION)
        .withProperty('when', predicateNode)
        .withProperty('message', 'Field is required')
        .withProperty('details', details)
        .build() as ValidationASTNode
      const handler = new ValidationHandler(validation.id, validation)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: false })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.details).toEqual(details)
    })

    it('should return passed false with user message when predicate evaluation fails', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const validation = ASTTestFactory.expression(ExpressionType.VALIDATION)
        .withProperty('when', predicateNode)
        .withProperty('message', 'Field is required')
        .build() as ValidationASTNode
      const handler = new ValidationHandler(validation.id, validation)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvokerWithError({ nodeId: predicateNode.id })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.passed).toBe(false)
      expect(result.value?.message).toBe('Field is required')
    })

    it('should return empty string when message evaluation fails', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const messageNode = ASTTestFactory.reference(['data', 'missing'])
      const validation = ASTTestFactory.expression(ExpressionType.VALIDATION)
        .withProperty('when', predicateNode)
        .withProperty('message', messageNode)
        .build() as ValidationASTNode
      const handler = new ValidationHandler(validation.id, validation)
      const mockContext = createMockContext()
      let callIndex = 0
      const mockInvoker = createMockInvoker({
        invokeImpl: async (): Promise<ThunkResult> => {
          if (callIndex === 0) {
            callIndex += 1

            return {
              value: true,
              metadata: { source: 'test', timestamp: Date.now() },
            }
          }

          callIndex += 1

          return {
            error: {
              type: 'EVALUATION_FAILED',
              nodeId: messageNode.id,
              message: 'Evaluation failed',
            },
            metadata: { source: 'test', timestamp: Date.now() },
          }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.message).toBe('')
    })

    it('should handle null as falsy predicate value', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const validation = ASTTestFactory.expression(ExpressionType.VALIDATION)
        .withProperty('when', predicateNode)
        .withProperty('message', 'Field is required')
        .build() as ValidationASTNode
      const handler = new ValidationHandler(validation.id, validation)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: null })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.passed).toBe(true)
    })

    it('should handle empty string as falsy predicate value', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const validation = ASTTestFactory.expression(ExpressionType.VALIDATION)
        .withProperty('when', predicateNode)
        .withProperty('message', 'Field is required')
        .build() as ValidationASTNode
      const handler = new ValidationHandler(validation.id, validation)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: '' })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.passed).toBe(true)
    })

    it('should handle numeric truthy predicate value', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const validation = ASTTestFactory.expression(ExpressionType.VALIDATION)
        .withProperty('when', predicateNode)
        .withProperty('message', 'Field is required')
        .build() as ValidationASTNode
      const handler = new ValidationHandler(validation.id, validation)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: 42 })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.passed).toBe(false)
    })
  })
})
