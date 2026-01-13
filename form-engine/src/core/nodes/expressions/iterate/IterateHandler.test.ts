import { AstNodeId, NodeId } from '@form-engine/core/types/engine.type'
import { IterateASTNode } from '@form-engine/core/types/expressions.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, IteratorType } from '@form-engine/form/types/enums'
import { ThunkResult } from '@form-engine/core/compilation/thunks/types'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createMockHooks,
  createSequentialMockInvoker,
} from '@form-engine/test-utils/thunkTestHelpers'
import IterateHandler from './IterateHandler'

describe('IterateHandler', () => {
  let handler: IterateHandler
  let iterateNode: IterateASTNode

  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  function createIterateNode(
    nodeId: AstNodeId,
    inputSourceId: NodeId,
    iterator: IterateASTNode['properties']['iterator'],
  ): IterateASTNode {
    return ASTTestFactory.expression<IterateASTNode>(ExpressionType.ITERATE)
      .withId(nodeId)
      .withProperty('input', { id: inputSourceId, type: ASTNodeType.EXPRESSION })
      .withProperty('iterator', iterator)
      .build()
  }

  describe('evaluate()', () => {
    describe('MAP iterator', () => {
      it('should transform each item using yield template', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const inputData = [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
          { id: 3, name: 'Charlie' },
        ]

        const yieldNodes = [
          { id: 'runtime_ast:100', type: ASTNodeType.EXPRESSION },
          { id: 'runtime_ast:101', type: ASTNodeType.EXPRESSION },
          { id: 'runtime_ast:102', type: ASTNodeType.EXPRESSION },
        ]

        const mockInvoker = createSequentialMockInvoker([inputData, 'Alice', 'Bob', 'Charlie'])

        const mockHooks = createMockHooks()
        yieldNodes.forEach(node => {
          mockHooks.transformValue.mockReturnValueOnce(node as any)
        })

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toEqual(['Alice', 'Bob', 'Charlie'])
        expect(result.metadata).toEqual({ source: 'IterateHandler.map' })
        expect(mockHooks.transformValue).toHaveBeenCalledTimes(3)
        expect(mockHooks.registerRuntimeNodesBatch).toHaveBeenCalledWith(yieldNodes, 'yield')
      })

      it('should evaluate plain object yield templates with nested AST nodes', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: {
            label: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
            value: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'id'] },
          },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const inputData = [
          { id: 'opt1', name: 'Option 1' },
          { id: 'opt2', name: 'Option 2' },
        ]

        const labelNode = { id: 'runtime_ast:200', type: ASTNodeType.EXPRESSION }
        const valueNode = { id: 'runtime_ast:201', type: ASTNodeType.EXPRESSION }

        const mockInvoker = createSequentialMockInvoker([inputData, 'Option 1', 'opt1', 'Option 2', 'opt2'])

        const mockHooks = createMockHooks()
        mockHooks.transformValue.mockImplementation(() => ({
          label: labelNode,
          value: valueNode,
        }))

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toEqual([
          { label: 'Option 1', value: 'opt1' },
          { label: 'Option 2', value: 'opt2' },
        ])
      })

      it('should skip null and undefined items in map', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const inputData = [{ name: 'Alice' }, null, undefined, { name: 'Bob' }]

        const yieldNode = { id: 'runtime_ast:100', type: ASTNodeType.EXPRESSION }

        const mockInvoker = createSequentialMockInvoker([inputData, 'Alice', 'Bob'])

        const mockHooks = createMockHooks()
        mockHooks.transformValue.mockReturnValue(yieldNode)

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toEqual(['Alice', 'Bob'])
        expect(mockHooks.transformValue).toHaveBeenCalledTimes(2)
      })
    })

    describe('FILTER iterator', () => {
      it('should keep items where predicate evaluates to true', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.FILTER,
          predicate: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'active'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const inputData = [
          { id: 1, active: true },
          { id: 2, active: false },
          { id: 3, active: true },
        ]

        const predicateNode = { id: 'runtime_ast:filter', type: ASTNodeType.EXPRESSION }

        const mockInvoker = createSequentialMockInvoker([inputData, true, false, true])

        const mockHooks = createMockHooks()
        mockHooks.transformValue.mockReturnValue(predicateNode)

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toEqual([
          { id: 1, active: true },
          { id: 3, active: true },
        ])
        expect(result.metadata).toEqual({ source: 'IterateHandler.filter' })
      })

      it('should return empty array when all items are filtered out', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.FILTER,
          predicate: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'active'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const inputData = [
          { id: 1, active: false },
          { id: 2, active: false },
        ]

        const predicateNode = { id: 'runtime_ast:filter', type: ASTNodeType.EXPRESSION }

        const mockInvoker = createSequentialMockInvoker([inputData, false, false])

        const mockHooks = createMockHooks()
        mockHooks.transformValue.mockReturnValue(predicateNode)

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toEqual([])
      })

      it('should skip null and undefined items in filter', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.FILTER,
          predicate: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'active'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const inputData = [{ id: 1, active: true }, null, undefined, { id: 2, active: true }]

        const predicateNode = { id: 'runtime_ast:filter', type: ASTNodeType.EXPRESSION }

        const mockInvoker = createSequentialMockInvoker([inputData, true, true])

        const mockHooks = createMockHooks()
        mockHooks.transformValue.mockReturnValue(predicateNode)

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toEqual([
          { id: 1, active: true },
          { id: 2, active: true },
        ])
        expect(mockHooks.transformValue).toHaveBeenCalledTimes(2)
      })
    })

    describe('FIND iterator', () => {
      it('should return first item where predicate evaluates to true', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.FIND,
          predicate: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'isTarget'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const inputData = [
          { id: 1, isTarget: false },
          { id: 2, isTarget: true },
          { id: 3, isTarget: true },
        ]

        const predicateNode = { id: 'runtime_ast:predicate', type: ASTNodeType.EXPRESSION }

        const mockInvoker = createSequentialMockInvoker([inputData, false, true])

        const mockHooks = createMockHooks()
        mockHooks.transformValue.mockReturnValue(predicateNode)

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toEqual({ id: 2, isTarget: true })
        expect(result.metadata).toEqual({ source: 'IterateHandler.find' })
        expect(mockInvoker.invoke).toHaveBeenCalledTimes(3)
      })

      it('should return undefined when no item matches predicate', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.FIND,
          predicate: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'isTarget'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const inputData = [
          { id: 1, isTarget: false },
          { id: 2, isTarget: false },
        ]

        const predicateNode = { id: 'runtime_ast:predicate', type: ASTNodeType.EXPRESSION }

        const mockInvoker = createSequentialMockInvoker([inputData, false, false])

        const mockHooks = createMockHooks()
        mockHooks.transformValue.mockReturnValue(predicateNode)

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toBeUndefined()
        expect(result.metadata).toEqual({ source: 'IterateHandler.find.notFound' })
      })

      it('should return undefined for empty array', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.FIND,
          predicate: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'isTarget'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const mockInvoker = createMockInvoker({ defaultValue: [] })
        const mockHooks = createMockHooks()

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toBeUndefined()
        expect(result.metadata).toEqual({ source: 'IterateHandler.find.empty' })
      })

      it('should skip null and undefined items in find', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.FIND,
          predicate: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'isTarget'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const inputData = [null, undefined, { id: 1, isTarget: true }]

        const predicateNode = { id: 'runtime_ast:predicate', type: ASTNodeType.EXPRESSION }

        const mockInvoker = createSequentialMockInvoker([inputData, true])

        const mockHooks = createMockHooks()
        mockHooks.transformValue.mockReturnValue(predicateNode)

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toEqual({ id: 1, isTarget: true })
        expect(mockHooks.transformValue).toHaveBeenCalledTimes(1)
      })
    })

    describe('common behavior', () => {
      it('should return empty array when input is empty array for MAP iterator', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const mockInvoker = createMockInvoker({ defaultValue: [] })
        const mockHooks = createMockHooks()

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toEqual([])
        expect(result.metadata).toEqual({ source: 'IterateHandler.empty' })
        expect(mockHooks.transformValue).not.toHaveBeenCalled()
      })

      it('should return empty array when input is empty array for FILTER iterator', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.FILTER,
          predicate: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'active'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const mockInvoker = createMockInvoker({ defaultValue: [] })
        const mockHooks = createMockHooks()

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toEqual([])
        expect(result.metadata).toEqual({ source: 'IterateHandler.empty' })
      })

      it('should propagate error when input evaluation fails', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const errorResult: ThunkResult = {
          error: {
            type: 'EVALUATION_FAILED',
            nodeId: inputSourceId,
            message: 'Failed to evaluate input',
          },
          metadata: { source: 'test' },
        }

        const mockInvoker = createMockInvoker({
          invokeImpl: async (): Promise<ThunkResult> => errorResult,
        })
        const mockHooks = createMockHooks()

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.error).toEqual(errorResult.error)
        expect(mockHooks.transformValue).not.toHaveBeenCalled()
      })

      it.each([
        ['string', 'not an array', 'string'],
        ['null', null, 'null'],
        ['undefined', undefined, 'undefined'],
        ['number', 42, 'number'],
      ])('should return error when input is %s (not iterable)', async (_label, invalidValue, _expectedType) => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const mockInvoker = createMockInvoker({ defaultValue: invalidValue as any })
        const mockHooks = createMockHooks()

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.error).toBeDefined()
        expect(result.error?.type).toBe('TYPE_MISMATCH')
        expect(result.error?.message).toContain('Type mismatch')
        expect(result.error?.message).toContain('expected array or object')
      })

      it('should handle literal array input directly without invoking', async () => {
        // Arrange
        const nodeId = 'compile_ast:2'
        const literalArray = [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ]

        iterateNode = ASTTestFactory.expression<IterateASTNode>(ExpressionType.ITERATE)
          .withId(nodeId)
          .withProperty('input', literalArray)
          .withProperty('iterator', {
            type: IteratorType.MAP,
            yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
          })
          .build()
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const yieldNode = { id: 'runtime_ast:100', type: ASTNodeType.EXPRESSION }

        const mockInvoker = createSequentialMockInvoker(['Alice', 'Bob'])
        const mockHooks = createMockHooks()
        mockHooks.transformValue.mockReturnValue(yieldNode)

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toEqual(['Alice', 'Bob'])
        expect(mockInvoker.invoke).toHaveBeenCalledTimes(2)
      })

      it('should clean up scope after evaluation', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const inputData = [{ name: 'Alice' }]

        const yieldNode = { id: 'runtime_ast:100', type: ASTNodeType.EXPRESSION }

        const mockInvoker = createSequentialMockInvoker([inputData, 'Alice'])
        const mockHooks = createMockHooks()
        mockHooks.transformValue.mockReturnValue(yieldNode)

        // Act
        await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(mockContext.scope).toHaveLength(0)
      })

      it('should provide @index in scope for each item', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', '@index'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const inputData = [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }]

        const yieldNode = { id: 'runtime_ast:100', type: ASTNodeType.EXPRESSION }

        const mockInvoker = createSequentialMockInvoker([inputData, 0, 1, 2])
        const mockHooks = createMockHooks()
        mockHooks.transformValue.mockReturnValue(yieldNode)

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toEqual([0, 1, 2])
      })
    })

    describe('object iteration', () => {
      it('should iterate over object entries with @key available in scope', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', '@key'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const inputData = {
          accommodation: { score: 5 },
          finances: { score: 3 },
          health: { score: 4 },
        }

        const yieldNode = { id: 'runtime_ast:100', type: ASTNodeType.EXPRESSION }

        const mockInvoker = createSequentialMockInvoker([inputData, 'accommodation', 'finances', 'health'])
        const mockHooks = createMockHooks()
        mockHooks.transformValue.mockReturnValue(yieldNode)

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toEqual(['accommodation', 'finances', 'health'])
        expect(result.metadata).toEqual({ source: 'IterateHandler.map' })
      })

      it('should allow access to object value properties alongside @key', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: {
            slug: { type: ExpressionType.REFERENCE, path: ['@scope', '0', '@key'] },
            score: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'score'] },
          },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const inputData = {
          accommodation: { score: 5, label: 'Accommodation' },
          finances: { score: 3, label: 'Finances' },
        }

        const keyNode = { id: 'runtime_ast:200', type: ASTNodeType.EXPRESSION }
        const scoreNode = { id: 'runtime_ast:201', type: ASTNodeType.EXPRESSION }

        const mockInvoker = createSequentialMockInvoker([inputData, 'accommodation', 5, 'finances', 3])
        const mockHooks = createMockHooks()
        mockHooks.transformValue.mockImplementation(() => ({
          slug: keyNode,
          score: scoreNode,
        }))

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toEqual([
          { slug: 'accommodation', score: 5 },
          { slug: 'finances', score: 3 },
        ])
      })

      it('should handle object with primitive values using @value', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: {
            area: { type: ExpressionType.REFERENCE, path: ['@scope', '0', '@key'] },
            score: { type: ExpressionType.REFERENCE, path: ['@scope', '0', '@value'] },
          },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const inputData = {
          accommodation: 5,
          finances: 3,
        }

        const keyNode = { id: 'runtime_ast:200', type: ASTNodeType.EXPRESSION }
        const valueNode = { id: 'runtime_ast:201', type: ASTNodeType.EXPRESSION }

        const mockInvoker = createSequentialMockInvoker([inputData, 'accommodation', 5, 'finances', 3])
        const mockHooks = createMockHooks()
        mockHooks.transformValue.mockImplementation(() => ({
          area: keyNode,
          score: valueNode,
        }))

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toEqual([
          { area: 'accommodation', score: 5 },
          { area: 'finances', score: 3 },
        ])
      })

      it('should filter object entries based on predicate', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.FILTER,
          predicate: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'active'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const inputData = {
          accommodation: { active: true, score: 5 },
          finances: { active: false, score: 3 },
          health: { active: true, score: 4 },
        }

        const predicateNode = { id: 'runtime_ast:filter', type: ASTNodeType.EXPRESSION }

        const mockInvoker = createSequentialMockInvoker([inputData, true, false, true])
        const mockHooks = createMockHooks()
        mockHooks.transformValue.mockReturnValue(predicateNode)

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toEqual([
          { '@key': 'accommodation', active: true, score: 5 },
          { '@key': 'health', active: true, score: 4 },
        ])
      })

      it('should find first matching object entry', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.FIND,
          predicate: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'priority'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const inputData = {
          accommodation: { priority: false },
          finances: { priority: true },
          health: { priority: true },
        }

        const predicateNode = { id: 'runtime_ast:predicate', type: ASTNodeType.EXPRESSION }

        const mockInvoker = createSequentialMockInvoker([inputData, false, true])
        const mockHooks = createMockHooks()
        mockHooks.transformValue.mockReturnValue(predicateNode)

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toEqual({ '@key': 'finances', priority: true })
        expect(result.metadata).toEqual({ source: 'IterateHandler.find' })
      })

      it('should return empty array for empty object', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', '@key'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const mockInvoker = createMockInvoker({ defaultValue: {} })
        const mockHooks = createMockHooks()

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toEqual([])
        expect(result.metadata).toEqual({ source: 'IterateHandler.empty' })
      })

      it('should provide @index for object entries in iteration order', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: {
            key: { type: ExpressionType.REFERENCE, path: ['@scope', '0', '@key'] },
            index: { type: ExpressionType.REFERENCE, path: ['@scope', '0', '@index'] },
          },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const inputData = {
          first: { data: 'a' },
          second: { data: 'b' },
          third: { data: 'c' },
        }

        const keyNode = { id: 'runtime_ast:200', type: ASTNodeType.EXPRESSION }
        const indexNode = { id: 'runtime_ast:201', type: ASTNodeType.EXPRESSION }

        const mockInvoker = createSequentialMockInvoker([inputData, 'first', 0, 'second', 1, 'third', 2])
        const mockHooks = createMockHooks()
        mockHooks.transformValue.mockImplementation(() => ({
          key: keyNode,
          index: indexNode,
        }))

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.value).toEqual([
          { key: 'first', index: 0 },
          { key: 'second', index: 1 },
          { key: 'third', index: 2 },
        ])
      })
    })
  })
})
