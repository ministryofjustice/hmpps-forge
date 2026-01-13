import { ExpressionType, PredicateType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createMockInvokerWithError,
  createSequentialMockInvoker,
} from '@form-engine/test-utils/thunkTestHelpers'
import { ThunkResult } from '@form-engine/core/compilation/thunks/types'
import ConditionalHandler from './ConditionalHandler'

describe('ConditionalHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return primitive thenValue when predicate is truthy', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const conditional = ASTTestFactory.expression(ExpressionType.CONDITIONAL)
        .withPredicate(predicateNode)
        .withThenValue('Admin Panel')
        .withElseValue('User Panel')
        .build()
      const handler = new ConditionalHandler(conditional.id, conditional as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: true })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('Admin Panel')
    })

    it('should evaluate and return AST node thenValue when predicate is truthy', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const thenValueNode = ASTTestFactory.reference(['data', 'adminTitle'])
      const conditional = ASTTestFactory.expression(ExpressionType.CONDITIONAL)
        .withPredicate(predicateNode)
        .withThenValue(thenValueNode)
        .withElseValue('User Panel')
        .build()
      const handler = new ConditionalHandler(conditional.id, conditional as any)
      const mockContext = createMockContext({
        mockNodes: new Map([[thenValueNode.id, thenValueNode]]),
      })
      const mockInvoker = createSequentialMockInvoker([true, 'Super Admin Panel'])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('Super Admin Panel')
    })

    it('should handle numeric truthy predicate values', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const conditional = ASTTestFactory.expression(ExpressionType.CONDITIONAL)
        .withPredicate(predicateNode)
        .withThenValue('Has value')
        .withElseValue('No value')
        .build()
      const handler = new ConditionalHandler(conditional.id, conditional as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: 42 })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('Has value')
    })

    it('should handle string truthy predicate values', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const conditional = ASTTestFactory.expression(ExpressionType.CONDITIONAL)
        .withPredicate(predicateNode)
        .withThenValue('Has value')
        .withElseValue('No value')
        .build()
      const handler = new ConditionalHandler(conditional.id, conditional as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: 'non-empty string' })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('Has value')
    })

    it('should return primitive elseValue when predicate is falsy', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const conditional = ASTTestFactory.expression(ExpressionType.CONDITIONAL)
        .withPredicate(predicateNode)
        .withThenValue('Admin Panel')
        .withElseValue('User Panel')
        .build()
      const handler = new ConditionalHandler(conditional.id, conditional as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: false })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('User Panel')
    })

    it('should evaluate and return AST node elseValue when predicate is falsy', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const elseValueNode = ASTTestFactory.reference(['data', 'userTitle'])
      const conditional = ASTTestFactory.expression(ExpressionType.CONDITIONAL)
        .withPredicate(predicateNode)
        .withThenValue('Admin Panel')
        .withElseValue(elseValueNode)
        .build()
      const handler = new ConditionalHandler(conditional.id, conditional as any)
      const mockContext = createMockContext({
        mockNodes: new Map([[elseValueNode.id, elseValueNode]]),
      })
      const mockInvoker = createSequentialMockInvoker([false, 'Standard User Panel'])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('Standard User Panel')
    })

    it('should handle null as falsy predicate', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const conditional = ASTTestFactory.expression(ExpressionType.CONDITIONAL)
        .withPredicate(predicateNode)
        .withThenValue('Has value')
        .withElseValue('No value')
        .build()
      const handler = new ConditionalHandler(conditional.id, conditional as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: null })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('No value')
    })

    it('should handle undefined as falsy predicate', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const conditional = ASTTestFactory.expression(ExpressionType.CONDITIONAL)
        .withPredicate(predicateNode)
        .withThenValue('Has value')
        .withElseValue('No value')
        .build()
      const handler = new ConditionalHandler(conditional.id, conditional as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: undefined })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('No value')
    })

    it('should handle 0 as falsy predicate', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const conditional = ASTTestFactory.expression(ExpressionType.CONDITIONAL)
        .withPredicate(predicateNode)
        .withThenValue('Has value')
        .withElseValue('No value')
        .build()
      const handler = new ConditionalHandler(conditional.id, conditional as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: 0 })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('No value')
    })

    it('should handle empty string as falsy predicate', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const conditional = ASTTestFactory.expression(ExpressionType.CONDITIONAL)
        .withPredicate(predicateNode)
        .withThenValue('Has value')
        .withElseValue('No value')
        .build()
      const handler = new ConditionalHandler(conditional.id, conditional as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: '' })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('No value')
    })

    it('should handle NaN as falsy predicate', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const conditional = ASTTestFactory.expression(ExpressionType.CONDITIONAL)
        .withPredicate(predicateNode)
        .withThenValue('Has value')
        .withElseValue('No value')
        .build()
      const handler = new ConditionalHandler(conditional.id, conditional as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: NaN })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('No value')
    })

    it('should handle BigInt zero (0n) as falsy predicate', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const conditional = ASTTestFactory.expression(ExpressionType.CONDITIONAL)
        .withPredicate(predicateNode)
        .withThenValue('Has value')
        .withElseValue('No value')
        .build()
      const handler = new ConditionalHandler(conditional.id, conditional as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: 0n })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('No value')
    })

    it('should return undefined when thenValue is not specified and predicate is true', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const conditional = ASTTestFactory.expression(ExpressionType.CONDITIONAL)
        .withPredicate(predicateNode)
        .withElseValue('User Panel')
        .build()
      const handler = new ConditionalHandler(conditional.id, conditional as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: true })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should return undefined when elseValue is not specified and predicate is false', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const conditional = ASTTestFactory.expression(ExpressionType.CONDITIONAL)
        .withPredicate(predicateNode)
        .withThenValue('Admin Panel')
        .build()
      const handler = new ConditionalHandler(conditional.id, conditional as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: false })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should return undefined when both thenValue and elseValue are not specified', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const conditional = ASTTestFactory.expression(ExpressionType.CONDITIONAL).withPredicate(predicateNode).build()
      const handler = new ConditionalHandler(conditional.id, conditional as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: true })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should return undefined when predicate evaluation fails', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const conditional = ASTTestFactory.expression(ExpressionType.CONDITIONAL)
        .withPredicate(predicateNode)
        .withThenValue('Admin Panel')
        .withElseValue('User Panel')
        .build()
      const handler = new ConditionalHandler(conditional.id, conditional as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvokerWithError()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it('should return undefined when thenValue evaluation fails', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const thenValueNode = ASTTestFactory.reference(['data', 'missing'])
      const conditional = ASTTestFactory.expression(ExpressionType.CONDITIONAL)
        .withPredicate(predicateNode)
        .withThenValue(thenValueNode)
        .withElseValue('User Panel')
        .build()
      const handler = new ConditionalHandler(conditional.id, conditional as any)
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
              nodeId: thenValueNode.id,
              message: 'Evaluation failed',
            },
            metadata: { source: 'test', timestamp: Date.now() },
          }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it('should return undefined when elseValue evaluation fails', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const elseValueNode = ASTTestFactory.reference(['data', 'missing'])
      const conditional = ASTTestFactory.expression(ExpressionType.CONDITIONAL)
        .withPredicate(predicateNode)
        .withThenValue('Admin Panel')
        .withElseValue(elseValueNode)
        .build()
      const handler = new ConditionalHandler(conditional.id, conditional as any)
      const mockContext = createMockContext()
      let callIndex = 0
      const mockInvoker = createMockInvoker({
        invokeImpl: async (): Promise<ThunkResult> => {
          if (callIndex === 0) {
            callIndex += 1
            return {
              value: false,
              metadata: { source: 'test', timestamp: Date.now() },
            }
          }

          callIndex += 1
          return {
            error: {
              type: 'EVALUATION_FAILED',
              nodeId: elseValueNode.id,
              message: 'Evaluation failed',
            },
            metadata: { source: 'test', timestamp: Date.now() },
          }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it('should evaluate and return correct branch when both values are AST nodes', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const thenValueNode = ASTTestFactory.reference(['data', 'adminTitle'])
      const elseValueNode = ASTTestFactory.reference(['data', 'userTitle'])
      const conditional = ASTTestFactory.expression(ExpressionType.CONDITIONAL)
        .withPredicate(predicateNode)
        .withThenValue(thenValueNode)
        .withElseValue(elseValueNode)
        .build()
      const handler = new ConditionalHandler(conditional.id, conditional as any)
      const mockContext = createMockContext({
        mockNodes: new Map([
          [thenValueNode.id, thenValueNode],
          [elseValueNode.id, elseValueNode],
        ]),
      })
      const mockInvoker = createSequentialMockInvoker([true, 'Admin Dashboard'])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('Admin Dashboard')
    })
  })
})
