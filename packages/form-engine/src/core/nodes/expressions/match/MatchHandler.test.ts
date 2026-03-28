import { ExpressionType, PredicateType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createSequentialMockInvoker,
} from '@form-engine/test-utils/thunkTestHelpers'
import { ThunkResult } from '@form-engine/core/compilation/thunks/types'
import MatchHandler from './MatchHandler'

describe('MatchHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return the first matching branch value', async () => {
      // Arrange
      const predicate1 = ASTTestFactory.predicate(PredicateType.TEST)
      const predicate2 = ASTTestFactory.predicate(PredicateType.TEST)
      const matchNode = ASTTestFactory.expression(ExpressionType.MATCH)
        .withProperty('branches', [
          { predicate: predicate1, value: 'First' },
          { predicate: predicate2, value: 'Second' },
        ])
        .withProperty('otherwise', 'Default')
        .build()
      const handler = new MatchHandler(matchNode.id, matchNode as any)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker([true])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('First')
    })

    it('should skip non-matching branches and return second match', async () => {
      // Arrange
      const predicate1 = ASTTestFactory.predicate(PredicateType.TEST)
      const predicate2 = ASTTestFactory.predicate(PredicateType.TEST)
      const matchNode = ASTTestFactory.expression(ExpressionType.MATCH)
        .withProperty('branches', [
          { predicate: predicate1, value: 'First' },
          { predicate: predicate2, value: 'Second' },
        ])
        .withProperty('otherwise', 'Default')
        .build()
      const handler = new MatchHandler(matchNode.id, matchNode as any)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker([false, true])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('Second')
    })

    it('should return otherwise when no branch matches', async () => {
      // Arrange
      const predicate1 = ASTTestFactory.predicate(PredicateType.TEST)
      const predicate2 = ASTTestFactory.predicate(PredicateType.TEST)
      const matchNode = ASTTestFactory.expression(ExpressionType.MATCH)
        .withProperty('branches', [
          { predicate: predicate1, value: 'First' },
          { predicate: predicate2, value: 'Second' },
        ])
        .withProperty('otherwise', 'Default')
        .build()
      const handler = new MatchHandler(matchNode.id, matchNode as any)
      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker([false, false])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('Default')
    })

    it('should return undefined when no branch matches and no otherwise is set', async () => {
      // Arrange
      const predicate1 = ASTTestFactory.predicate(PredicateType.TEST)
      const matchNode = ASTTestFactory.expression(ExpressionType.MATCH)
        .withProperty('branches', [{ predicate: predicate1, value: 'First' }])
        .build()
      const handler = new MatchHandler(matchNode.id, matchNode as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: false })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBeUndefined()
    })

    it('should evaluate and return AST node branch value when matched', async () => {
      // Arrange
      const predicate1 = ASTTestFactory.predicate(PredicateType.TEST)
      const valueNode = ASTTestFactory.reference(['data', 'title'])
      const matchNode = ASTTestFactory.expression(ExpressionType.MATCH)
        .withProperty('branches', [{ predicate: predicate1, value: valueNode }])
        .withProperty('otherwise', 'Default')
        .build()
      const handler = new MatchHandler(matchNode.id, matchNode as any)
      const mockContext = createMockContext({
        mockNodes: new Map([[valueNode.id, valueNode]]),
      })
      const mockInvoker = createSequentialMockInvoker([true, 'Dynamic Title'])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('Dynamic Title')
    })

    it('should evaluate and return AST node otherwise value', async () => {
      // Arrange
      const predicate1 = ASTTestFactory.predicate(PredicateType.TEST)
      const otherwiseNode = ASTTestFactory.reference(['data', 'fallback'])
      const matchNode = ASTTestFactory.expression(ExpressionType.MATCH)
        .withProperty('branches', [{ predicate: predicate1, value: 'First' }])
        .withProperty('otherwise', otherwiseNode)
        .build()
      const handler = new MatchHandler(matchNode.id, matchNode as any)
      const mockContext = createMockContext({
        mockNodes: new Map([[otherwiseNode.id, otherwiseNode]]),
      })
      const mockInvoker = createSequentialMockInvoker([false, 'Fallback Value'])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('Fallback Value')
    })

    it('should skip branches whose predicate evaluation fails', async () => {
      // Arrange
      const predicate1 = ASTTestFactory.predicate(PredicateType.TEST)
      const predicate2 = ASTTestFactory.predicate(PredicateType.TEST)
      const matchNode = ASTTestFactory.expression(ExpressionType.MATCH)
        .withProperty('branches', [
          { predicate: predicate1, value: 'First' },
          { predicate: predicate2, value: 'Second' },
        ])
        .withProperty('otherwise', 'Default')
        .build()
      const handler = new MatchHandler(matchNode.id, matchNode as any)
      const mockContext = createMockContext()
      let callIndex = 0
      const mockInvoker = createMockInvoker({
        invokeImpl: async (): Promise<ThunkResult> => {
          callIndex += 1

          if (callIndex === 1) {
            return {
              error: {
                type: 'EVALUATION_FAILED',
                nodeId: predicate1.id,
                message: 'Evaluation failed',
              },
              metadata: { source: 'test', timestamp: Date.now() },
            }
          }

          return {
            value: true,
            metadata: { source: 'test', timestamp: Date.now() },
          }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('Second')
    })

    it('should use first-match semantics when multiple branches match', async () => {
      // Arrange
      const predicate1 = ASTTestFactory.predicate(PredicateType.TEST)
      const predicate2 = ASTTestFactory.predicate(PredicateType.TEST)
      const matchNode = ASTTestFactory.expression(ExpressionType.MATCH)
        .withProperty('branches', [
          { predicate: predicate1, value: 'First' },
          { predicate: predicate2, value: 'Second' },
        ])
        .build()
      const handler = new MatchHandler(matchNode.id, matchNode as any)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: true })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toBe('First')
    })
  })
})
