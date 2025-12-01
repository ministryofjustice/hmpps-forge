import { LogicType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createMockInvokerWithError,
  createSequentialMockInvoker,
} from '@form-engine/test-utils/thunkTestHelpers'
import XorPredicateHandler from './XorPredicateHandler'

describe('XorPredicateHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return true for single truthy primitive value', async () => {
      // Arrange
      const xorPredicate = ASTTestFactory.predicate(LogicType.XOR, {
        operands: [true] as any,
      })
      const handler = new XorPredicateHandler(xorPredicate.id, xorPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(true)
    })

    it('should return true when exactly one primitive operand is truthy among many', async () => {
      // Arrange
      const xorPredicate = ASTTestFactory.predicate(LogicType.XOR, {
        operands: [false, 1, null] as any,
      })
      const handler = new XorPredicateHandler(xorPredicate.id, xorPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(true)
    })

    it('should return false for three truthy primitive operands (not exactly one)', async () => {
      // Arrange
      const xorPredicate = ASTTestFactory.predicate(LogicType.XOR, {
        operands: [true, true, true] as any,
      })
      const handler = new XorPredicateHandler(xorPredicate.id, xorPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
    })

    it('should return false for mixed primitive truthy values (even count)', async () => {
      // Arrange
      const xorPredicate = ASTTestFactory.predicate(LogicType.XOR, {
        operands: [true, 1, 'yes', { foo: 'bar' }] as any,
      })
      const handler = new XorPredicateHandler(xorPredicate.id, xorPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
    })

    it('should return false when both primitive operands are truthy', async () => {
      // Arrange
      const xorPredicate = ASTTestFactory.predicate(LogicType.XOR, {
        operands: [true, true] as any,
      })
      const handler = new XorPredicateHandler(xorPredicate.id, xorPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
    })

    it('should return false when all primitive operands are falsy', async () => {
      // Arrange
      const xorPredicate = ASTTestFactory.predicate(LogicType.XOR, {
        operands: [false, false, false] as any,
      })
      const handler = new XorPredicateHandler(xorPredicate.id, xorPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
    })

    it('should handle various falsy primitive values (0, "", null, undefined) correctly', async () => {
      // Arrange
      const xorPredicate = ASTTestFactory.predicate(LogicType.XOR, {
        operands: [true, 0, '', null, undefined, false] as any,
      })
      const handler = new XorPredicateHandler(xorPredicate.id, xorPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(true)
    })

    it('should return false for empty operands array (even count: 0)', async () => {
      // Arrange
      const xorPredicate = ASTTestFactory.predicate(LogicType.XOR, {
        operands: [],
      })
      const handler = new XorPredicateHandler(xorPredicate.id, xorPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
    })

    it('should evaluate all AST node operands and return true for odd truthy count', async () => {
      // Arrange
      const operand1 = ASTTestFactory.predicate(LogicType.TEST)
      const operand2 = ASTTestFactory.predicate(LogicType.TEST)
      const operand3 = ASTTestFactory.predicate(LogicType.TEST)
      const xorPredicate = ASTTestFactory.predicate(LogicType.XOR, {
        operands: [operand1, operand2, operand3],
      })
      const handler = new XorPredicateHandler(xorPredicate.id, xorPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker([true, false, false])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(true)
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(3)
    })

    it('should evaluate all AST node operands and return false for even truthy count', async () => {
      // Arrange
      const operand1 = ASTTestFactory.predicate(LogicType.TEST)
      const operand2 = ASTTestFactory.predicate(LogicType.TEST)
      const operand3 = ASTTestFactory.predicate(LogicType.TEST)
      const xorPredicate = ASTTestFactory.predicate(LogicType.XOR, {
        operands: [operand1, operand2, operand3],
      })
      const handler = new XorPredicateHandler(xorPredicate.id, xorPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker([true, true, false])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(3)
    })

    it('should handle mixed AST nodes and primitives', async () => {
      // Arrange
      const operand1 = ASTTestFactory.predicate(LogicType.TEST)
      const operand2 = ASTTestFactory.predicate(LogicType.TEST)
      const xorPredicate = ASTTestFactory.predicate(LogicType.XOR, {
        operands: [operand1, true, operand2, false] as any,
      })
      const handler = new XorPredicateHandler(xorPredicate.id, xorPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker([true, false])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(2)
    })

    it('should handle nested XOR predicates correctly', async () => {
      // Arrange
      const innerXor = ASTTestFactory.predicate(LogicType.XOR)
      const operand1 = ASTTestFactory.predicate(LogicType.TEST)
      const outerXor = ASTTestFactory.predicate(LogicType.XOR, {
        operands: [innerXor, operand1, false] as any,
      })
      const handler = new XorPredicateHandler(outerXor.id, outerXor as any)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker([true, false])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(true)
    })

    it('should treat failed evaluations as falsy', async () => {
      // Arrange
      const operand1 = ASTTestFactory.predicate(LogicType.TEST)
      const operand2 = ASTTestFactory.predicate(LogicType.TEST)
      const xorPredicate = ASTTestFactory.predicate(LogicType.XOR, {
        operands: [operand1, operand2],
      })
      const handler = new XorPredicateHandler(xorPredicate.id, xorPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvokerWithError()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
    })

    it('should continue evaluating after failed operand', async () => {
      // Arrange
      const operand1 = ASTTestFactory.predicate(LogicType.TEST)
      const operand2 = ASTTestFactory.predicate(LogicType.TEST)
      const operand3 = ASTTestFactory.predicate(LogicType.TEST)
      const xorPredicate = ASTTestFactory.predicate(LogicType.XOR, {
        operands: [operand1, operand2, operand3],
      })
      const handler = new XorPredicateHandler(xorPredicate.id, xorPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        invokeImpl: jest
          .fn()
          .mockResolvedValueOnce({
            value: true,
            metadata: { source: 'test', timestamp: Date.now() },
          })
          .mockResolvedValueOnce({
            error: {
              type: 'EVALUATION_FAILED',
              nodeId: 'compile_ast:100',
              message: 'Evaluation failed',
            },
            metadata: { source: 'test', timestamp: Date.now() },
          })
          .mockResolvedValueOnce({
            value: false,
            metadata: { source: 'test', timestamp: Date.now() },
          }),
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(true)
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(3)
    })
  })
})
