import { PredicateType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createSequentialMockInvoker,
} from '@form-engine/test-utils/thunkTestHelpers'
import { ThunkResult } from '@form-engine/core/compilation/thunks/types'
import AndHandler from './AndHandler'

describe('AndHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return true for primitive truthy values when all operands are truthy', async () => {
      // Arrange
      const andPredicate = ASTTestFactory.predicate(PredicateType.AND, {
        operands: [true, 1, 'yes', { foo: 'bar' }] as any,
      })
      const handler = new AndHandler(andPredicate.id, andPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(true)
    })

    it('should return true when all AST node operands evaluate to truthy', async () => {
      // Arrange
      const operand1 = ASTTestFactory.predicate(PredicateType.TEST)
      const operand2 = ASTTestFactory.predicate(PredicateType.TEST)
      const operand3 = ASTTestFactory.predicate(PredicateType.TEST)
      const andPredicate = ASTTestFactory.predicate(PredicateType.AND, {
        operands: [operand1, operand2, operand3],
      })
      const handler = new AndHandler(andPredicate.id, andPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker([true, true, true])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(true)
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(3)
    })

    it('should return true for mixed AST nodes and primitives when all are truthy', async () => {
      // Arrange
      const operand1 = ASTTestFactory.predicate(PredicateType.TEST)
      const operand2 = ASTTestFactory.predicate(PredicateType.TEST)
      const andPredicate = ASTTestFactory.predicate(PredicateType.AND, {
        operands: [operand1, true, operand2, 'yes'] as any,
      })
      const handler = new AndHandler(andPredicate.id, andPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker([true, true])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(true)
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(2)
    })

    it('should return false when first operand is false', async () => {
      // Arrange
      const andPredicate = ASTTestFactory.predicate(PredicateType.AND, {
        operands: [false, true, true] as any,
      })
      const handler = new AndHandler(andPredicate.id, andPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
    })

    it('should return false when middle operand is false', async () => {
      // Arrange
      const andPredicate = ASTTestFactory.predicate(PredicateType.AND, {
        operands: [true, false, true] as any,
      })
      const handler = new AndHandler(andPredicate.id, andPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
    })

    it('should return false when last operand is false', async () => {
      // Arrange
      const andPredicate = ASTTestFactory.predicate(PredicateType.AND, {
        operands: [true, true, false] as any,
      })
      const handler = new AndHandler(andPredicate.id, andPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
    })

    it('should return false for 0 operand', async () => {
      // Arrange
      const andPredicate = ASTTestFactory.predicate(PredicateType.AND, {
        operands: [true, 0, true] as any,
      })
      const handler = new AndHandler(andPredicate.id, andPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
    })

    it('should return false for empty string operand', async () => {
      // Arrange
      const andPredicate = ASTTestFactory.predicate(PredicateType.AND, {
        operands: [true, '', true] as any,
      })
      const handler = new AndHandler(andPredicate.id, andPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
    })

    it('should return false for null operand', async () => {
      // Arrange
      const andPredicate = ASTTestFactory.predicate(PredicateType.AND, {
        operands: [true, null, true] as any,
      })
      const handler = new AndHandler(andPredicate.id, andPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
    })

    it('should return false for undefined operand', async () => {
      // Arrange
      const andPredicate = ASTTestFactory.predicate(PredicateType.AND, {
        operands: [true, undefined, true] as any,
      })
      const handler = new AndHandler(andPredicate.id, andPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
    })

    it('should stop evaluating after first falsy operand (short-circuit)', async () => {
      // Arrange
      const operand1 = ASTTestFactory.predicate(PredicateType.TEST)
      const operand2 = ASTTestFactory.predicate(PredicateType.TEST)
      const operand3 = ASTTestFactory.predicate(PredicateType.TEST)
      const andPredicate = ASTTestFactory.predicate(PredicateType.AND, {
        operands: [operand1, operand2, operand3],
      })
      const handler = new AndHandler(andPredicate.id, andPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker([true, false, true])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(2) // Should stop after second operand
    })

    it('should evaluate all operands when all are truthy', async () => {
      // Arrange
      const operand1 = ASTTestFactory.predicate(PredicateType.TEST)
      const operand2 = ASTTestFactory.predicate(PredicateType.TEST)
      const operand3 = ASTTestFactory.predicate(PredicateType.TEST)
      const andPredicate = ASTTestFactory.predicate(PredicateType.AND, {
        operands: [operand1, operand2, operand3],
      })
      const handler = new AndHandler(andPredicate.id, andPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker([true, true, true])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(true)
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(3) // All operands evaluated
    })

    it('should return true for empty operands array (vacuous truth)', async () => {
      // Arrange
      const andPredicate = ASTTestFactory.predicate(PredicateType.AND, {
        operands: [],
      })
      const handler = new AndHandler(andPredicate.id, andPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(true)
    })

    it('should return false when any operand fails to evaluate', async () => {
      // Arrange
      const operand1 = ASTTestFactory.predicate(PredicateType.TEST)
      const operand2 = ASTTestFactory.predicate(PredicateType.TEST)
      const andPredicate = ASTTestFactory.predicate(PredicateType.AND, {
        operands: [operand1, operand2],
      })
      const handler = new AndHandler(andPredicate.id, andPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        invokeImpl: async () => ({
          error: {
            type: 'EVALUATION_FAILED',
            nodeId: 'compile_ast:100',
            message: 'Evaluation failed',
          },
          metadata: { source: 'test', timestamp: Date.now() },
        }),
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
    })

    it('should return false when second operand fails to evaluate', async () => {
      // Arrange
      const operand1 = ASTTestFactory.predicate(PredicateType.TEST)
      const operand2 = ASTTestFactory.predicate(PredicateType.TEST)
      const andPredicate = ASTTestFactory.predicate(PredicateType.AND, {
        operands: [operand1, operand2],
      })
      const handler = new AndHandler(andPredicate.id, andPredicate as any)
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
              nodeId: 'compile_ast:100',
              message: 'Evaluation failed',
            },
            metadata: { source: 'test', timestamp: Date.now() },
          }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
    })

    it('should handle nested AND predicates correctly', async () => {
      // Arrange
      const innerAnd = ASTTestFactory.predicate(PredicateType.AND)
      const operand1 = ASTTestFactory.predicate(PredicateType.TEST)
      const outerAnd = ASTTestFactory.predicate(PredicateType.AND, {
        operands: [innerAnd, operand1, true] as any,
      })
      const handler = new AndHandler(outerAnd.id, outerAnd as any)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker([true, true])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(true)
    })
  })
})
