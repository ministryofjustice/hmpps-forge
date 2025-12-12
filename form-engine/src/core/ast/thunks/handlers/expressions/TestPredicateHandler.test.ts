import { LogicType, FunctionType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createMockInvokerWithError,
  createSequentialMockInvoker,
} from '@form-engine/test-utils/thunkTestHelpers'
import { ThunkResult } from '@form-engine/core/ast/thunks/types'
import TestPredicateHandler from './TestPredicateHandler'

describe('TestPredicateHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  /**
   * Helper to create a TestPredicateHandler with default or custom options
   */
  function createTestPredicateHandler(
    options: {
      subjectPath?: string[]
      conditionName?: string
      negate?: boolean
    } = {},
  ): TestPredicateHandler {
    const { subjectPath = ['answers', 'field'], conditionName = 'testCondition', negate = false } = options

    const subject = ASTTestFactory.reference(subjectPath)
    const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, conditionName, [])

    const testPredicate = ASTTestFactory.predicate(LogicType.TEST, {
      subject,
      condition,
      negate,
    })

    return new TestPredicateHandler(testPredicate.id, testPredicate as any)
  }

  describe('evaluate()', () => {
    it.each([
      {
        description: 'return true when condition is truthy and negate is false',
        conditionResult: true,
        negate: false,
        expectedResult: true,
      },
      {
        description: 'return false when condition is truthy and negate is true',
        conditionResult: true,
        negate: true,
        expectedResult: false,
      },
      {
        description: 'return false when condition is falsy and negate is false',
        conditionResult: false,
        negate: false,
        expectedResult: false,
      },
      {
        description: 'return true when condition is falsy and negate is true',
        conditionResult: false,
        negate: true,
        expectedResult: true,
      },
    ])('should $description', async ({ conditionResult, negate, expectedResult }) => {
      // Arrange
      const handler = createTestPredicateHandler({ negate })
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker(['subject-value', conditionResult])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(expectedResult)
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(2)
    })

    it('should propagate error when subject evaluation fails', async () => {
      // Arrange
      const handler = createTestPredicateHandler()
      const mockContext = createMockContext()
      const mockInvoker = createMockInvokerWithError({ message: 'Subject evaluation failed' })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.error).toBeDefined()
      expect(result.error?.message).toBe('Subject evaluation failed')
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(1)
    })

    it('should propagate error when condition evaluation fails', async () => {
      // Arrange
      const handler = createTestPredicateHandler()
      const mockContext = createMockContext()
      let callIndex = 0
      const mockInvoker = createMockInvoker({
        invokeImpl: async (): Promise<ThunkResult> => {
          if (callIndex === 0) {
            callIndex += 1
            return {
              value: 'subject-value',
              metadata: { source: 'test', timestamp: Date.now() },
            }
          }

          callIndex += 1
          return {
            error: {
              type: 'EVALUATION_FAILED',
              nodeId: 'compile_ast:101',
              message: 'Condition evaluation failed',
            },
            metadata: { source: 'test', timestamp: Date.now() },
          }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.error).toBeDefined()
      expect(result.error?.message).toBe('Condition evaluation failed')
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(2)
    })
  })
})
