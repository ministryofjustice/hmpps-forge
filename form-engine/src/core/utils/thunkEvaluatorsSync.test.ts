import {
  createMockContext,
  createMockInvoker,
  createMockInvokerWithError,
} from '@form-engine/test-utils/thunkTestHelpers'
import { ThunkResult } from '@form-engine/core/compilation/thunks/types'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  evaluateOperandSync,
  evaluateOperandWithErrorTrackingSync,
  evaluateWithScopeSync,
  evaluatePropertyValueSync,
  evaluateUntilFirstMatchSync,
  evaluateNextOutcomesSync,
} from './thunkEvaluatorsSync'

describe('thunkEvaluatorsSync', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluateOperandSync()', () => {
    it('should return primitive values as-is', () => {
      // Arrange
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const stringResult = evaluateOperandSync('hello', mockContext, mockInvoker)
      const numberResult = evaluateOperandSync(42, mockContext, mockInvoker)
      const boolResult = evaluateOperandSync(true, mockContext, mockInvoker)

      // Assert
      expect(stringResult).toBe('hello')
      expect(numberResult).toBe(42)
      expect(boolResult).toBe(true)
      expect(mockInvoker.invokeSync).not.toHaveBeenCalled()
    })

    it('should invoke AST nodes and return their value', () => {
      // Arrange
      const node = ASTTestFactory.reference(['answers', 'email'])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        returnValueMap: new Map([[node.id, 'test@example.com']]),
      })

      // Act
      const result = evaluateOperandSync(node, mockContext, mockInvoker)

      // Assert
      expect(result).toBe('test@example.com')
      expect(mockInvoker.invokeSync).toHaveBeenCalledWith(node.id, mockContext)
    })

    it('should return undefined when AST node evaluation fails', () => {
      // Arrange
      const node = ASTTestFactory.reference(['answers', 'missing'])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvokerWithError({ nodeId: node.id, message: 'failed' })

      // Act
      const result = evaluateOperandSync(node, mockContext, mockInvoker)

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('evaluateOperandWithErrorTrackingSync()', () => {
    it('should return value with failed=false for primitives', () => {
      // Arrange
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = evaluateOperandWithErrorTrackingSync('hello', mockContext, mockInvoker)

      // Assert
      expect(result).toEqual({ value: 'hello', failed: false })
    })

    it('should return value with failed=false for successful AST evaluation', () => {
      // Arrange
      const node = ASTTestFactory.reference(['answers', 'email'])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        returnValueMap: new Map([[node.id, 'test@example.com']]),
      })

      // Act
      const result = evaluateOperandWithErrorTrackingSync(node, mockContext, mockInvoker)

      // Assert
      expect(result).toEqual({ value: 'test@example.com', failed: false })
    })

    it('should return undefined with failed=true when evaluation fails', () => {
      // Arrange
      const node = ASTTestFactory.reference(['answers', 'missing'])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvokerWithError({ nodeId: node.id, message: 'failed' })

      // Act
      const result = evaluateOperandWithErrorTrackingSync(node, mockContext, mockInvoker)

      // Assert
      expect(result).toEqual({ value: undefined, failed: true })
    })
  })

  describe('evaluateWithScopeSync()', () => {
    it('should execute evaluator with scope bindings available', () => {
      // Arrange
      const mockContext = createMockContext()
      let capturedScope: Record<string, unknown>[] = []

      // Act
      const result = evaluateWithScopeSync({ '@value': 'test-value', '@index': 0 }, mockContext, () => {
        capturedScope = [...mockContext.scope]
        return 'result'
      })

      // Assert
      expect(result).toBe('result')
      expect(capturedScope).toContainEqual({ '@value': 'test-value', '@index': 0 })
    })

    it('should pop scope after evaluator completes', () => {
      // Arrange
      const mockContext = createMockContext()
      const initialScopeLength = mockContext.scope.length

      // Act
      evaluateWithScopeSync({ '@value': 'test' }, mockContext, () => 'done')

      // Assert
      expect(mockContext.scope.length).toBe(initialScopeLength)
    })

    it('should pop scope even when evaluator throws', () => {
      // Arrange
      const mockContext = createMockContext()
      const initialScopeLength = mockContext.scope.length

      // Act & Assert
      expect(() =>
        evaluateWithScopeSync({ '@value': 'test' }, mockContext, () => {
          throw new Error('evaluator failed')
        }),
      ).toThrow('evaluator failed')

      expect(mockContext.scope.length).toBe(initialScopeLength)
    })
  })

  describe('evaluatePropertyValueSync()', () => {
    it('should pass through null and undefined', () => {
      // Arrange
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const nullResult = evaluatePropertyValueSync(null, mockContext, mockInvoker)
      const undefinedResult = evaluatePropertyValueSync(undefined, mockContext, mockInvoker)

      // Assert
      expect(nullResult).toBeNull()
      expect(undefinedResult).toBeUndefined()
    })

    it('should pass through primitive values', () => {
      // Arrange
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const stringResult = evaluatePropertyValueSync('hello', mockContext, mockInvoker)
      const numberResult = evaluatePropertyValueSync(42, mockContext, mockInvoker)
      const boolResult = evaluatePropertyValueSync(true, mockContext, mockInvoker)

      // Assert
      expect(stringResult).toBe('hello')
      expect(numberResult).toBe(42)
      expect(boolResult).toBe(true)
    })

    it('should evaluate registered AST nodes', () => {
      // Arrange
      const node = ASTTestFactory.reference(['answers', 'email'])
      const mockContext = createMockContext({
        mockNodes: new Map([[node.id, node]]),
      })
      const mockInvoker = createMockInvoker({
        returnValueMap: new Map([[node.id, 'test@example.com']]),
      })

      // Act
      const result = evaluatePropertyValueSync(node, mockContext, mockInvoker)

      // Assert
      expect(result).toBe('test@example.com')
    })

    it('should filter out unregistered AST nodes (return undefined)', () => {
      // Arrange
      const node = ASTTestFactory.reference(['answers', 'email'])
      const mockContext = createMockContext({
        mockNodes: new Map(), // node not registered
      })
      const mockInvoker = createMockInvoker()

      // Act
      const result = evaluatePropertyValueSync(node, mockContext, mockInvoker)

      // Assert - should return undefined since node is not registered
      expect(result).toBeUndefined()
      expect(mockInvoker.invokeSync).not.toHaveBeenCalled()
    })

    it('should recursively evaluate array elements', () => {
      // Arrange
      const node1 = ASTTestFactory.reference(['answers', 'field1'])
      const node2 = ASTTestFactory.reference(['answers', 'field2'])
      const mockContext = createMockContext({
        mockNodes: new Map([
          [node1.id, node1],
          [node2.id, node2],
        ]),
      })
      const mockInvoker = createMockInvoker({
        returnValueMap: new Map([
          [node1.id, 'value1'],
          [node2.id, 'value2'],
        ]),
      })

      // Act
      const result = evaluatePropertyValueSync(['static', node1, node2], mockContext, mockInvoker)

      // Assert
      expect(result).toEqual(['static', 'value1', 'value2'])
    })

    it('should filter out unregistered AST nodes from arrays', () => {
      // Arrange
      const registeredNode = ASTTestFactory.reference(['answers', 'field1'])
      const unregisteredNode = ASTTestFactory.reference(['answers', 'field2'])
      const mockContext = createMockContext({
        mockNodes: new Map([[registeredNode.id, registeredNode]]), // only first node registered
      })
      const mockInvoker = createMockInvoker({
        returnValueMap: new Map([[registeredNode.id, 'value1']]),
      })

      // Act
      const result = evaluatePropertyValueSync(['static', registeredNode, unregisteredNode], mockContext, mockInvoker)

      // Assert - unregistered node should be filtered out
      expect(result).toEqual(['static', 'value1'])
    })

    it('should recursively evaluate object properties', () => {
      // Arrange
      const labelNode = ASTTestFactory.reference(['data', 'label'])
      const mockContext = createMockContext({
        mockNodes: new Map([[labelNode.id, labelNode]]),
      })
      const mockInvoker = createMockInvoker({
        returnValueMap: new Map([[labelNode.id, 'Dynamic Label']]),
      })

      // Act
      const result = evaluatePropertyValueSync(
        {
          code: 'field1',
          label: labelNode,
          required: true,
        },
        mockContext,
        mockInvoker,
      )

      // Assert
      expect(result).toEqual({
        code: 'field1',
        label: 'Dynamic Label',
        required: true,
      })
    })

    it('should handle deeply nested structures', () => {
      // Arrange
      const innerNode = ASTTestFactory.reference(['answers', 'inner'])
      const mockContext = createMockContext({
        mockNodes: new Map([[innerNode.id, innerNode]]),
      })
      const mockInvoker = createMockInvoker({
        returnValueMap: new Map([[innerNode.id, 'resolved']]),
      })

      // Act
      const result = evaluatePropertyValueSync(
        {
          outer: {
            middle: {
              items: [innerNode, 'static'],
            },
          },
        },
        mockContext,
        mockInvoker,
      )

      // Assert
      expect(result).toEqual({
        outer: {
          middle: {
            items: ['resolved', 'static'],
          },
        },
      })
    })

    it('should return undefined when AST node evaluation fails', () => {
      // Arrange
      const node = ASTTestFactory.reference(['answers', 'missing'])
      const mockContext = createMockContext({
        mockNodes: new Map([[node.id, node]]),
      })
      const invoker = createMockInvokerWithError({ nodeId: node.id, message: 'failed' })

      // Act
      const result = evaluatePropertyValueSync(node, mockContext, invoker)

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('evaluateUntilFirstMatchSync()', () => {
    it('should return undefined when no nodes provided', () => {
      // Arrange
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = evaluateUntilFirstMatchSync([], mockContext, mockInvoker)

      // Assert
      expect(result).toBeUndefined()
      expect(mockInvoker.invokeSync).not.toHaveBeenCalled()
    })

    it('should return first matching value with default predicate', () => {
      // Arrange
      const node1 = ASTTestFactory.reference(['data', 'first'])
      const node2 = ASTTestFactory.reference(['data', 'second'])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        invokeSyncImpl: (nodeId: string) => {
          if (nodeId === node1.id) {
            return { value: undefined, metadata: { source: 'Test', timestamp: Date.now() } }
          }

          return { value: '/redirect', metadata: { source: 'Test', timestamp: Date.now() } }
        },
      })

      // Act
      const result = evaluateUntilFirstMatchSync([node1.id, node2.id], mockContext, mockInvoker)

      // Assert
      expect(result).toBe('/redirect')
    })

    it('should stop evaluating after first match', () => {
      // Arrange
      const node1 = ASTTestFactory.reference(['data', 'first'])
      const node2 = ASTTestFactory.reference(['data', 'second'])
      const node3 = ASTTestFactory.reference(['data', 'third'])
      const mockContext = createMockContext()
      const invocationOrder: string[] = []
      const mockInvoker = createMockInvoker({
        invokeSyncImpl: (nodeId: string) => {
          invocationOrder.push(nodeId)

          if (nodeId === node2.id) {
            return { value: 'match', metadata: { source: 'Test', timestamp: Date.now() } }
          }

          return { value: undefined, metadata: { source: 'Test', timestamp: Date.now() } }
        },
      })

      // Act
      const result = evaluateUntilFirstMatchSync([node1.id, node2.id, node3.id], mockContext, mockInvoker)

      // Assert
      expect(result).toBe('match')
      expect(invocationOrder).toEqual([node1.id, node2.id])
      expect(invocationOrder).not.toContain(node3.id)
    })

    it('should return undefined when no values match', () => {
      // Arrange
      const node1 = ASTTestFactory.reference(['data', 'first'])
      const node2 = ASTTestFactory.reference(['data', 'second'])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: undefined })

      // Act
      const result = evaluateUntilFirstMatchSync([node1.id, node2.id], mockContext, mockInvoker)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should skip nodes that return errors', () => {
      // Arrange
      const node1 = ASTTestFactory.reference(['data', 'failing'])
      const node2 = ASTTestFactory.reference(['data', 'success'])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        invokeSyncImpl: (nodeId): ThunkResult => {
          if (nodeId === node1.id) {
            return {
              error: { type: 'EVALUATION_FAILED', nodeId: node1.id, message: 'Error' },
              metadata: { source: 'Test', timestamp: Date.now() },
            }
          }

          return { value: '/success', metadata: { source: 'Test', timestamp: Date.now() } }
        },
      })

      // Act
      const result = evaluateUntilFirstMatchSync([node1.id, node2.id], mockContext, mockInvoker)

      // Assert
      expect(result).toBe('/success')
    })

    it('should use custom predicate when provided', () => {
      // Arrange
      const node1 = ASTTestFactory.reference(['data', 'first'])
      const node2 = ASTTestFactory.reference(['data', 'second'])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        invokeSyncImpl: (nodeId: string) => {
          if (nodeId === node1.id) {
            return { value: 'skip-me', metadata: { source: 'Test', timestamp: Date.now() } }
          }

          return { value: 'match-me', metadata: { source: 'Test', timestamp: Date.now() } }
        },
      })

      // Act - custom predicate that only matches values starting with 'match'
      const result = evaluateUntilFirstMatchSync(
        [node1.id, node2.id],
        mockContext,
        mockInvoker,
        value => typeof value === 'string' && value.startsWith('match'),
      )

      // Assert
      expect(result).toBe('match-me')
    })
  })

  describe('evaluateNextOutcomesSync()', () => {
    it('should return none when no outcomes provided', () => {
      // Arrange
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = evaluateNextOutcomesSync([], mockContext, mockInvoker)

      // Assert
      expect(result).toEqual({ type: 'none' })
      expect(mockInvoker.invokeSync).not.toHaveBeenCalled()
    })

    it('should return redirect outcome when redirect matches', () => {
      // Arrange
      const redirectOutcome = ASTTestFactory.redirectOutcome({ goto: '/next-page' })
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        returnValueMap: new Map([[redirectOutcome.id, '/next-page']]),
      })

      // Act
      const result = evaluateNextOutcomesSync([redirectOutcome], mockContext, mockInvoker)

      // Assert
      expect(result).toEqual({ type: 'redirect', value: '/next-page' })
    })

    it('should return error outcome when throwError matches', () => {
      // Arrange
      const errorOutcome = ASTTestFactory.throwErrorOutcome({ status: 404, message: 'Not found' })
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        returnValueMap: new Map([[errorOutcome.id, { status: 404, message: 'Not found' }]]),
      })

      // Act
      const result = evaluateNextOutcomesSync([errorOutcome], mockContext, mockInvoker)

      // Assert
      expect(result).toEqual({ type: 'error', value: { status: 404, message: 'Not found' } })
    })

    it('should use first-match semantics - return first matching outcome', () => {
      // Arrange
      const redirect1 = ASTTestFactory.redirectOutcome({ goto: '/first' })
      const redirect2 = ASTTestFactory.redirectOutcome({ goto: '/second' })
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        returnValueMap: new Map([
          [redirect1.id, '/first'],
          [redirect2.id, '/second'],
        ]),
      })

      // Act
      const result = evaluateNextOutcomesSync([redirect1, redirect2], mockContext, mockInvoker)

      // Assert
      expect(result).toEqual({ type: 'redirect', value: '/first' })
      expect(mockInvoker.invokeSync).toHaveBeenCalledTimes(1)
    })

    it('should skip outcomes that return undefined (when condition not met)', () => {
      // Arrange
      const redirect1 = ASTTestFactory.redirectOutcome({ goto: '/first' })
      const redirect2 = ASTTestFactory.redirectOutcome({ goto: '/second' })
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        invokeSyncImpl: (nodeId: string): ThunkResult => {
          if (nodeId === redirect1.id) {
            return { value: undefined, metadata: { source: 'Test', timestamp: Date.now() } }
          }

          return { value: '/second', metadata: { source: 'Test', timestamp: Date.now() } }
        },
      })

      // Act
      const result = evaluateNextOutcomesSync([redirect1, redirect2], mockContext, mockInvoker)

      // Assert
      expect(result).toEqual({ type: 'redirect', value: '/second' })
    })

    it('should skip outcomes that return errors', () => {
      // Arrange
      const redirect1 = ASTTestFactory.redirectOutcome({ goto: '/first' })
      const redirect2 = ASTTestFactory.redirectOutcome({ goto: '/second' })
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        invokeSyncImpl: (nodeId: string): ThunkResult => {
          if (nodeId === redirect1.id) {
            return {
              error: { type: 'EVALUATION_FAILED', nodeId: redirect1.id, message: 'Error' },
              metadata: { source: 'Test', timestamp: Date.now() },
            }
          }

          return { value: '/second', metadata: { source: 'Test', timestamp: Date.now() } }
        },
      })

      // Act
      const result = evaluateNextOutcomesSync([redirect1, redirect2], mockContext, mockInvoker)

      // Assert
      expect(result).toEqual({ type: 'redirect', value: '/second' })
    })

    it('should return none when all outcomes return undefined', () => {
      // Arrange
      const redirect1 = ASTTestFactory.redirectOutcome({ goto: '/first' })
      const redirect2 = ASTTestFactory.redirectOutcome({ goto: '/second' })
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: undefined })

      // Act
      const result = evaluateNextOutcomesSync([redirect1, redirect2], mockContext, mockInvoker)

      // Assert
      expect(result).toEqual({ type: 'none' })
    })

    it('should handle mixed redirect and error outcomes', () => {
      // Arrange
      const errorOutcome = ASTTestFactory.throwErrorOutcome({ status: 404, message: 'Not found' })
      const redirectOutcome = ASTTestFactory.redirectOutcome({ goto: '/fallback' })
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        invokeSyncImpl: (nodeId: string): ThunkResult => {
          if (nodeId === errorOutcome.id) {
            return { value: undefined, metadata: { source: 'Test', timestamp: Date.now() } }
          }

          return { value: '/fallback', metadata: { source: 'Test', timestamp: Date.now() } }
        },
      })

      // Act
      const result = evaluateNextOutcomesSync([errorOutcome, redirectOutcome], mockContext, mockInvoker)

      // Assert
      expect(result).toEqual({ type: 'redirect', value: '/fallback' })
    })
  })
})
