import { PredicateType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { createMockContext, createMockInvoker } from '@form-engine/test-utils/thunkTestHelpers'
import NotHandler from './NotHandler'

describe('NotHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return true for various falsy primitive values (0, "", null, undefined)', async () => {
      // Arrange
      const falsyValues = [0, '', null, undefined]
      const testCases = falsyValues.map(async value => {
        const notPredicate = ASTTestFactory.predicate(PredicateType.NOT, {
          operand: value,
        } as any)
        const handler = new NotHandler(notPredicate.id, notPredicate as any)
        const mockContext = createMockContext()
        const mockInvoker = createMockInvoker()

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker)

        // Assert
        expect(result.value).toBe(true)
      })

      await Promise.all(testCases)
    })

    it('should return false for various truthy primitive values (1, "yes", {})', async () => {
      // Arrange
      const truthyValues = [1, 'yes', { foo: 'bar' }]
      const testCases = truthyValues.map(async value => {
        const notPredicate = ASTTestFactory.predicate(PredicateType.NOT, {
          operand: value,
        } as any)
        const handler = new NotHandler(notPredicate.id, notPredicate as any)
        const mockContext = createMockContext()
        const mockInvoker = createMockInvoker()

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker)

        // Assert
        expect(result.value).toBe(false)
      })

      await Promise.all(testCases)
    })

    it('should return false when AST node operand evaluates to truthy', async () => {
      // Arrange
      const operand = ASTTestFactory.predicate(PredicateType.TEST)
      const notPredicate = ASTTestFactory.predicate(PredicateType.NOT, {
        operand,
      } as any)
      const handler = new NotHandler(notPredicate.id, notPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: true })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(false)
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(1)
    })

    it('should return true when AST node operand evaluates to falsy', async () => {
      // Arrange
      const operand = ASTTestFactory.predicate(PredicateType.TEST)
      const notPredicate = ASTTestFactory.predicate(PredicateType.NOT, {
        operand,
      } as any)
      const handler = new NotHandler(notPredicate.id, notPredicate as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: false })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe(true)
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(1)
    })

    it('should treat failed evaluation as falsy and return true', async () => {
      // Arrange
      const operand = ASTTestFactory.predicate(PredicateType.TEST)
      const notPredicate = ASTTestFactory.predicate(PredicateType.NOT, {
        operand,
      } as any)
      const handler = new NotHandler(notPredicate.id, notPredicate as any)
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
      expect(result.value).toBe(true)
    })
  })
})
