import { PredicateType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createSequentialMockInvoker,
} from '@form-engine/test-utils/thunkTestHelpers'
import OrHandler from './OrHandler'

describe('OrHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it.each([
      { description: 'single truthy primitive value', operands: [true] },
      { description: 'any operand in array is truthy', operands: [false, true, false] },
    ])('should return true for $description', async ({ operands }) => {
      // Arrange
      const orPredicate = ASTTestFactory.predicate(PredicateType.OR, {
        operands: operands as any,
      })
      const handler = new OrHandler(orPredicate.id, orPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(true)
    })

    it('should return true when AST node operand evaluates to truthy', async () => {
      // Arrange
      const operand1 = ASTTestFactory.predicate(PredicateType.TEST)
      const operand2 = ASTTestFactory.predicate(PredicateType.TEST)
      const orPredicate = ASTTestFactory.predicate(PredicateType.OR, {
        operands: [operand1, operand2],
      })
      const handler = new OrHandler(orPredicate.id, orPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker([false, true])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(true)
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(2)
    })

    it('should return true for mixed AST nodes and primitives when any is truthy', async () => {
      // Arrange
      const operand1 = ASTTestFactory.predicate(PredicateType.TEST)
      const operand2 = ASTTestFactory.predicate(PredicateType.TEST)
      const orPredicate = ASTTestFactory.predicate(PredicateType.OR, {
        operands: [operand1, false, operand2, false] as any,
      })
      const handler = new OrHandler(orPredicate.id, orPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker([false, true])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(true)
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(2)
    })

    it('should return false for falsy primitive values when all operands are falsy', async () => {
      // Arrange
      const orPredicate = ASTTestFactory.predicate(PredicateType.OR, {
        operands: [false, false, false] as any,
      })
      const handler = new OrHandler(orPredicate.id, orPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
    })

    it('should return false when all AST node operands evaluate to falsy', async () => {
      // Arrange
      const operand1 = ASTTestFactory.predicate(PredicateType.TEST)
      const operand2 = ASTTestFactory.predicate(PredicateType.TEST)
      const operand3 = ASTTestFactory.predicate(PredicateType.TEST)
      const orPredicate = ASTTestFactory.predicate(PredicateType.OR, {
        operands: [operand1, operand2, operand3],
      })
      const handler = new OrHandler(orPredicate.id, orPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker([false, false, false])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(3)
    })

    it('should stop evaluating after first truthy operand (short-circuit)', async () => {
      // Arrange
      const operand1 = ASTTestFactory.predicate(PredicateType.TEST)
      const operand2 = ASTTestFactory.predicate(PredicateType.TEST)
      const operand3 = ASTTestFactory.predicate(PredicateType.TEST)
      const orPredicate = ASTTestFactory.predicate(PredicateType.OR, {
        operands: [operand1, operand2, operand3],
      })
      const handler = new OrHandler(orPredicate.id, orPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker([false, true, false])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(true)
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(2) // Should stop after second operand
    })

    it('should return false for empty operands array (no truthy values)', async () => {
      // Arrange
      const orPredicate = ASTTestFactory.predicate(PredicateType.OR, {
        operands: [],
      })
      const handler = new OrHandler(orPredicate.id, orPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
    })

    it('should continue evaluating when first operand fails and find truthy value', async () => {
      // Arrange
      const operand1 = ASTTestFactory.predicate(PredicateType.TEST)
      const operand2 = ASTTestFactory.predicate(PredicateType.TEST)
      const orPredicate = ASTTestFactory.predicate(PredicateType.OR, {
        operands: [operand1, operand2],
      })
      const handler = new OrHandler(orPredicate.id, orPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        invokeImpl: jest
          .fn()
          .mockResolvedValueOnce({
            error: {
              type: 'EVALUATION_FAILED',
              nodeId: 'compile_ast:100',
              message: 'Evaluation failed',
            },
            metadata: { source: 'test', timestamp: Date.now() },
          })
          .mockResolvedValueOnce({
            value: true,
            metadata: { source: 'test', timestamp: Date.now() },
          }),
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(true)
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(2)
    })

    it('should return false when all operand evaluations fail', async () => {
      // Arrange
      const operand1 = ASTTestFactory.predicate(PredicateType.TEST)
      const operand2 = ASTTestFactory.predicate(PredicateType.TEST)
      const orPredicate = ASTTestFactory.predicate(PredicateType.OR, {
        operands: [operand1, operand2],
      })
      const handler = new OrHandler(orPredicate.id, orPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        invokeImpl: jest.fn().mockResolvedValue({
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
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(2)
    })
  })
})
