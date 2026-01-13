import {
  createMockContext,
  createMockInvoker,
  createMockInvokerWithError,
} from '@form-engine/test-utils/thunkTestHelpers'
import { ThunkResult } from '@form-engine/core/compilation/thunks/types'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  evaluateOperand,
  evaluateOperandWithErrorTracking,
  evaluateWithScope,
  evaluatePropertyValue,
  evaluateUntilFirstMatch,
} from './thunkEvaluatorsAsync'

describe('thunkEvaluatorsAsync', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluateOperand()', () => {
    it('should return primitive values as-is', async () => {
      // Arrange
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const stringResult = await evaluateOperand('hello', mockContext, mockInvoker)
      const numberResult = await evaluateOperand(42, mockContext, mockInvoker)
      const boolResult = await evaluateOperand(true, mockContext, mockInvoker)

      // Assert
      expect(stringResult).toBe('hello')
      expect(numberResult).toBe(42)
      expect(boolResult).toBe(true)
      expect(mockInvoker.invoke).not.toHaveBeenCalled()
    })

    it('should invoke AST nodes and return their value', async () => {
      // Arrange
      const node = ASTTestFactory.reference(['answers', 'email'])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        returnValueMap: new Map([[node.id, 'test@example.com']]),
      })

      // Act
      const result = await evaluateOperand(node, mockContext, mockInvoker)

      // Assert
      expect(result).toBe('test@example.com')
      expect(mockInvoker.invoke).toHaveBeenCalledWith(node.id, mockContext)
    })

    it('should return undefined when AST node evaluation fails', async () => {
      // Arrange
      const node = ASTTestFactory.reference(['answers', 'missing'])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvokerWithError({ nodeId: node.id, message: 'failed' })

      // Act
      const result = await evaluateOperand(node, mockContext, mockInvoker)

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('evaluateOperandWithErrorTracking()', () => {
    it('should return value with failed=false for primitives', async () => {
      // Arrange
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await evaluateOperandWithErrorTracking('hello', mockContext, mockInvoker)

      // Assert
      expect(result).toEqual({ value: 'hello', failed: false })
    })

    it('should return value with failed=false for successful AST evaluation', async () => {
      // Arrange
      const node = ASTTestFactory.reference(['answers', 'email'])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        returnValueMap: new Map([[node.id, 'test@example.com']]),
      })

      // Act
      const result = await evaluateOperandWithErrorTracking(node, mockContext, mockInvoker)

      // Assert
      expect(result).toEqual({ value: 'test@example.com', failed: false })
    })

    it('should return undefined with failed=true when evaluation fails', async () => {
      // Arrange
      const node = ASTTestFactory.reference(['answers', 'missing'])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvokerWithError({ nodeId: node.id, message: 'failed' })

      // Act
      const result = await evaluateOperandWithErrorTracking(node, mockContext, mockInvoker)

      // Assert
      expect(result).toEqual({ value: undefined, failed: true })
    })
  })

  describe('evaluateWithScope()', () => {
    it('should execute evaluator with scope bindings available', async () => {
      // Arrange
      const mockContext = createMockContext()
      let capturedScope: Record<string, unknown>[] = []

      // Act
      const result = await evaluateWithScope({ '@value': 'test-value', '@index': 0 }, mockContext, async () => {
        capturedScope = [...mockContext.scope]
        return 'result'
      })

      // Assert
      expect(result).toBe('result')
      expect(capturedScope).toContainEqual({ '@value': 'test-value', '@index': 0 })
    })

    it('should pop scope after evaluator completes', async () => {
      // Arrange
      const mockContext = createMockContext()
      const initialScopeLength = mockContext.scope.length

      // Act
      await evaluateWithScope({ '@value': 'test' }, mockContext, async () => 'done')

      // Assert
      expect(mockContext.scope.length).toBe(initialScopeLength)
    })

    it('should pop scope even when evaluator throws', async () => {
      // Arrange
      const mockContext = createMockContext()
      const initialScopeLength = mockContext.scope.length

      // Act & Assert
      await expect(
        evaluateWithScope({ '@value': 'test' }, mockContext, async () => {
          throw new Error('evaluator failed')
        }),
      ).rejects.toThrow('evaluator failed')

      expect(mockContext.scope.length).toBe(initialScopeLength)
    })
  })

  describe('evaluatePropertyValue()', () => {
    it('should pass through null and undefined', async () => {
      // Arrange
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const nullResult = await evaluatePropertyValue(null, mockContext, mockInvoker)
      const undefinedResult = await evaluatePropertyValue(undefined, mockContext, mockInvoker)

      // Assert
      expect(nullResult).toBeNull()
      expect(undefinedResult).toBeUndefined()
    })

    it('should pass through primitive values', async () => {
      // Arrange
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const stringResult = await evaluatePropertyValue('hello', mockContext, mockInvoker)
      const numberResult = await evaluatePropertyValue(42, mockContext, mockInvoker)
      const boolResult = await evaluatePropertyValue(true, mockContext, mockInvoker)

      // Assert
      expect(stringResult).toBe('hello')
      expect(numberResult).toBe(42)
      expect(boolResult).toBe(true)
    })

    it('should evaluate registered AST nodes', async () => {
      // Arrange
      const node = ASTTestFactory.reference(['answers', 'email'])
      const mockContext = createMockContext({
        mockNodes: new Map([[node.id, node]]),
      })
      const mockInvoker = createMockInvoker({
        returnValueMap: new Map([[node.id, 'test@example.com']]),
      })

      // Act
      const result = await evaluatePropertyValue(node, mockContext, mockInvoker)

      // Assert
      expect(result).toBe('test@example.com')
    })

    it('should filter out unregistered AST nodes (return undefined)', async () => {
      // Arrange
      const node = ASTTestFactory.reference(['answers', 'email'])
      const mockContext = createMockContext({
        mockNodes: new Map(), // node not registered
      })
      const mockInvoker = createMockInvoker()

      // Act
      const result = await evaluatePropertyValue(node, mockContext, mockInvoker)

      // Assert - should return undefined since node is not registered
      expect(result).toBeUndefined()
      expect(mockInvoker.invoke).not.toHaveBeenCalled()
    })

    it('should recursively evaluate array elements', async () => {
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
      const result = await evaluatePropertyValue(['static', node1, node2], mockContext, mockInvoker)

      // Assert
      expect(result).toEqual(['static', 'value1', 'value2'])
    })

    it('should filter out unregistered AST nodes from arrays', async () => {
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
      const result = await evaluatePropertyValue(['static', registeredNode, unregisteredNode], mockContext, mockInvoker)

      // Assert - unregistered node should be filtered out
      expect(result).toEqual(['static', 'value1'])
    })

    it('should recursively evaluate object properties', async () => {
      // Arrange
      const labelNode = ASTTestFactory.reference(['data', 'label'])
      const mockContext = createMockContext({
        mockNodes: new Map([[labelNode.id, labelNode]]),
      })
      const mockInvoker = createMockInvoker({
        returnValueMap: new Map([[labelNode.id, 'Dynamic Label']]),
      })

      // Act
      const result = await evaluatePropertyValue(
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

    it('should handle deeply nested structures', async () => {
      // Arrange
      const innerNode = ASTTestFactory.reference(['answers', 'inner'])
      const mockContext = createMockContext({
        mockNodes: new Map([[innerNode.id, innerNode]]),
      })
      const mockInvoker = createMockInvoker({
        returnValueMap: new Map([[innerNode.id, 'resolved']]),
      })

      // Act
      const result = await evaluatePropertyValue(
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

    it('should return undefined when AST node evaluation fails', async () => {
      // Arrange
      const node = ASTTestFactory.reference(['answers', 'missing'])
      const mockContext = createMockContext({
        mockNodes: new Map([[node.id, node]]),
      })
      const invoker = createMockInvokerWithError({ nodeId: node.id, message: 'failed' })

      // Act
      const result = await evaluatePropertyValue(node, mockContext, invoker)

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('evaluateUntilFirstMatch()', () => {
    it('should return undefined when no nodes provided', async () => {
      // Arrange
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await evaluateUntilFirstMatch([], mockContext, mockInvoker)

      // Assert
      expect(result).toBeUndefined()
      expect(mockInvoker.invoke).not.toHaveBeenCalled()
    })

    it('should return first matching value with default predicate', async () => {
      // Arrange
      const node1 = ASTTestFactory.reference(['data', 'first'])
      const node2 = ASTTestFactory.reference(['data', 'second'])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        invokeImpl: async (nodeId: string) => {
          if (nodeId === node1.id) {
            return { value: undefined, metadata: { source: 'Test', timestamp: Date.now() } }
          }

          return { value: '/redirect', metadata: { source: 'Test', timestamp: Date.now() } }
        },
      })

      // Act
      const result = await evaluateUntilFirstMatch([node1.id, node2.id], mockContext, mockInvoker)

      // Assert
      expect(result).toBe('/redirect')
    })

    it('should stop evaluating after first match', async () => {
      // Arrange
      const node1 = ASTTestFactory.reference(['data', 'first'])
      const node2 = ASTTestFactory.reference(['data', 'second'])
      const node3 = ASTTestFactory.reference(['data', 'third'])
      const mockContext = createMockContext()
      const invocationOrder: string[] = []
      const mockInvoker = createMockInvoker({
        invokeImpl: async (nodeId: string) => {
          invocationOrder.push(nodeId)

          if (nodeId === node2.id) {
            return { value: 'match', metadata: { source: 'Test', timestamp: Date.now() } }
          }

          return { value: undefined, metadata: { source: 'Test', timestamp: Date.now() } }
        },
      })

      // Act
      const result = await evaluateUntilFirstMatch([node1.id, node2.id, node3.id], mockContext, mockInvoker)

      // Assert
      expect(result).toBe('match')
      expect(invocationOrder).toEqual([node1.id, node2.id])
      expect(invocationOrder).not.toContain(node3.id)
    })

    it('should return undefined when no values match', async () => {
      // Arrange
      const node1 = ASTTestFactory.reference(['data', 'first'])
      const node2 = ASTTestFactory.reference(['data', 'second'])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: undefined })

      // Act
      const result = await evaluateUntilFirstMatch([node1.id, node2.id], mockContext, mockInvoker)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should skip nodes that return errors', async () => {
      // Arrange
      const node1 = ASTTestFactory.reference(['data', 'failing'])
      const node2 = ASTTestFactory.reference(['data', 'success'])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        invokeImpl: async (nodeId): Promise<ThunkResult> => {
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
      const result = await evaluateUntilFirstMatch([node1.id, node2.id], mockContext, mockInvoker)

      // Assert
      expect(result).toBe('/success')
    })

    it('should use custom predicate when provided', async () => {
      // Arrange
      const node1 = ASTTestFactory.reference(['data', 'first'])
      const node2 = ASTTestFactory.reference(['data', 'second'])
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        invokeImpl: async (nodeId: string) => {
          if (nodeId === node1.id) {
            return { value: 'skip-me', metadata: { source: 'Test', timestamp: Date.now() } }
          }

          return { value: 'match-me', metadata: { source: 'Test', timestamp: Date.now() } }
        },
      })

      // Act - custom predicate that only matches values starting with 'match'
      const result = await evaluateUntilFirstMatch(
        [node1.id, node2.id],
        mockContext,
        mockInvoker,
        value => typeof value === 'string' && value.startsWith('match'),
      )

      // Assert
      expect(result).toBe('match-me')
    })
  })
})
