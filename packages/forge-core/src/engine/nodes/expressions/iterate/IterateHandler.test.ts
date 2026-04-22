import { AstNodeId, NodeId } from '../../../types/ast.type'
import { IterateASTNode } from '../../../types/expressions.type'
import { ASTNodeType } from '../../../types/enums'
import { ExpressionType, FunctionType, IteratorType } from '../../../../authoring/types/enums'
import { MetadataComputationDependencies, ThunkResult } from '../../../compilation/thunks/types'
import { ASTTestFactory, createMockContext, createMockInvoker, createSequentialMockInvoker } from '../../../../testing'
import { NodeIDGenerator } from '../../../compilation/id-generators/NodeIDGenerator'
import TemplateFactory from '../../template/TemplateFactory'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import IterateHandler from './IterateHandler'

vi.mock('../../../runtime/expansion/registerRuntimeNodes', () => ({
  default: vi.fn().mockReturnValue([]),
}))

type IteratorTestInput = IterateASTNode['properties']['iterator'] & {
  yield?: unknown
  predicate?: unknown
}

describe('IterateHandler', () => {
  let handler: IterateHandler
  let iterateNode: IterateASTNode
  let templateFactory: TemplateFactory

  beforeEach(() => {
    ASTTestFactory.resetIds()
    templateFactory = new TemplateFactory(new NodeIDGenerator())
  })

  function createIterateNode(nodeId: AstNodeId, inputSourceId: NodeId, iterator: IteratorTestInput): IterateASTNode {
    const normalisedIterator: IterateASTNode['properties']['iterator'] = {
      type: iterator.type,
    }

    if (iterator.yieldTemplate !== undefined) {
      normalisedIterator.yieldTemplate = iterator.yieldTemplate
    } else if (iterator.yield !== undefined) {
      normalisedIterator.yieldTemplate = templateFactory.compile(iterator.yield)
    }

    if (iterator.predicateTemplate !== undefined) {
      normalisedIterator.predicateTemplate = iterator.predicateTemplate
    } else if (iterator.predicate !== undefined) {
      normalisedIterator.predicateTemplate = templateFactory.compile(iterator.predicate)
    }

    return ASTTestFactory.expression<IterateASTNode>(ExpressionType.ITERATE)
      .withId(nodeId)
      .withProperty('input', { id: inputSourceId, type: ASTNodeType.EXPRESSION })
      .withProperty('iterator', normalisedIterator)
      .build()
  }

  function createMockMetadataDeps(
    overrides: Partial<MetadataComputationDependencies> = {},
  ): MetadataComputationDependencies {
    return {
      thunkHandlerRegistry: {
        get: vi.fn().mockReturnValue(undefined),
      },
      functionRegistry: new FunctionRegistry(),
      nodeRegistry: {},
      metadataRegistry: {
        set: vi.fn(),
        get: vi.fn(),
      },
      ...overrides,
    } as unknown as MetadataComputationDependencies
  }

  describe('computeIsAsync()', () => {
    it('should set isAsync to false when input is a sync handler', () => {
      // Arrange
      const inputSourceId = 'compile_ast:1'
      const nodeId = 'compile_ast:2'
      iterateNode = createIterateNode(nodeId, inputSourceId, {
        type: IteratorType.MAP,
        yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
      })
      handler = new IterateHandler(nodeId, iterateNode)

      const deps = createMockMetadataDeps({
        thunkHandlerRegistry: {
          get: vi.fn().mockReturnValue({ isAsync: false }),
        } as any,
      })

      // Act
      handler.computeIsAsync(deps)

      // Assert
      expect(handler.isAsync).toBe(false)
    })

    it('should set isAsync to true when input is an async handler', () => {
      // Arrange
      const inputSourceId = 'compile_ast:1'
      const nodeId = 'compile_ast:2'
      iterateNode = createIterateNode(nodeId, inputSourceId, {
        type: IteratorType.MAP,
        yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
      })
      handler = new IterateHandler(nodeId, iterateNode)

      const deps = createMockMetadataDeps({
        thunkHandlerRegistry: {
          get: vi.fn().mockReturnValue({ isAsync: true }),
        } as any,
      })

      // Act
      handler.computeIsAsync(deps)

      // Assert
      expect(handler.isAsync).toBe(true)
    })

    it('should default to async when input handler is not found', () => {
      // Arrange
      const inputSourceId = 'compile_ast:1'
      const nodeId = 'compile_ast:2'
      iterateNode = createIterateNode(nodeId, inputSourceId, {
        type: IteratorType.MAP,
        yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
      })
      handler = new IterateHandler(nodeId, iterateNode)

      const deps = createMockMetadataDeps()

      // Act
      handler.computeIsAsync(deps)

      // Assert
      expect(handler.isAsync).toBe(true)
    })

    it('should set isAsync to false when input is a literal array', () => {
      // Arrange
      const nodeId = 'compile_ast:2'
      iterateNode = ASTTestFactory.expression<IterateASTNode>(ExpressionType.ITERATE)
        .withId(nodeId)
        .withProperty('input', [1, 2, 3])
        .withProperty('iterator', { type: IteratorType.MAP })
        .build()
      handler = new IterateHandler(nodeId, iterateNode)

      const deps = createMockMetadataDeps()

      // Act
      handler.computeIsAsync(deps)

      // Assert
      expect(handler.isAsync).toBe(false)
    })

    it('should set isAsync to true when yield template contains an async function', () => {
      // Arrange
      const inputSourceId = 'compile_ast:1'
      const nodeId = 'compile_ast:2'
      const asyncRegistry = new FunctionRegistry()
      asyncRegistry.register({ fetchData: { name: 'fetchData', evaluate: (): undefined => undefined, isAsync: true } })

      iterateNode = createIterateNode(nodeId, inputSourceId, {
        type: IteratorType.MAP,
        yield: {
          type: ASTNodeType.EXPRESSION,
          expressionType: FunctionType.CONDITION,
          properties: { name: 'fetchData', arguments: [] },
        },
      })
      handler = new IterateHandler(nodeId, iterateNode)

      const deps = createMockMetadataDeps({
        thunkHandlerRegistry: {
          get: vi.fn().mockReturnValue({ isAsync: false }),
        } as any,
        functionRegistry: asyncRegistry,
      })

      // Act
      handler.computeIsAsync(deps)

      // Assert
      expect(handler.isAsync).toBe(true)
    })

    it('should set isAsync to true when predicate template contains an async function', () => {
      // Arrange
      const inputSourceId = 'compile_ast:1'
      const nodeId = 'compile_ast:2'
      const asyncRegistry = new FunctionRegistry()
      asyncRegistry.register({ fetchData: { name: 'fetchData', evaluate: (): undefined => undefined, isAsync: true } })

      iterateNode = createIterateNode(nodeId, inputSourceId, {
        type: IteratorType.FILTER,
        predicate: {
          type: ASTNodeType.EXPRESSION,
          expressionType: FunctionType.CONDITION,
          properties: { name: 'fetchData', arguments: [] },
        },
      })
      handler = new IterateHandler(nodeId, iterateNode)

      const deps = createMockMetadataDeps({
        thunkHandlerRegistry: {
          get: vi.fn().mockReturnValue({ isAsync: false }),
        } as any,
        functionRegistry: asyncRegistry,
      })

      // Act
      handler.computeIsAsync(deps)

      // Assert
      expect(handler.isAsync).toBe(true)
    })

    it('should set isAsync to false when templates contain only sync functions', () => {
      // Arrange
      const inputSourceId = 'compile_ast:1'
      const nodeId = 'compile_ast:2'
      const syncRegistry = new FunctionRegistry()
      syncRegistry.register({ isEqual: { name: 'isEqual', evaluate: (): undefined => undefined, isAsync: false } })

      iterateNode = createIterateNode(nodeId, inputSourceId, {
        type: IteratorType.MAP,
        yield: {
          type: ASTNodeType.EXPRESSION,
          expressionType: FunctionType.CONDITION,
          properties: { name: 'isEqual', arguments: [] },
        },
      })
      handler = new IterateHandler(nodeId, iterateNode)

      const deps = createMockMetadataDeps({
        thunkHandlerRegistry: {
          get: vi.fn().mockReturnValue({ isAsync: false }),
        } as any,
        functionRegistry: syncRegistry,
      })

      // Act
      handler.computeIsAsync(deps)

      // Assert
      expect(handler.isAsync).toBe(false)
    })

    it('should store isTemplateAsync in metadata registry', () => {
      // Arrange
      const inputSourceId = 'compile_ast:1'
      const nodeId = 'compile_ast:2'
      iterateNode = createIterateNode(nodeId, inputSourceId, {
        type: IteratorType.MAP,
        yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
      })
      handler = new IterateHandler(nodeId, iterateNode)

      const deps = createMockMetadataDeps({
        thunkHandlerRegistry: {
          get: vi.fn().mockReturnValue({ isAsync: false }),
        } as any,
      })

      // Act
      handler.computeIsAsync(deps)

      // Assert
      expect(deps.metadataRegistry.set).toHaveBeenCalledWith(nodeId, 'isTemplateAsync', false)
    })
  })

  describe('evaluateSync()', () => {
    describe('MAP iterator', () => {
      it('should evaluate each pre-expanded item from the cache', () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const yieldNodes = [
          { id: 'runtime_ast:100', type: ASTNodeType.EXPRESSION },
          { id: 'runtime_ast:101', type: ASTNodeType.EXPRESSION },
          { id: 'runtime_ast:102', type: ASTNodeType.EXPRESSION },
        ]

        mockContext.runtimeExpansionState.preparedIterators.set(nodeId, {
          items: [
            {
              itemScope: { name: 'Alice', '@index': 0, '@type': 'iterator', '@item': { name: 'Alice' } },
              yieldValue: yieldNodes[0],
            },
            {
              itemScope: { name: 'Bob', '@index': 1, '@type': 'iterator', '@item': { name: 'Bob' } },
              yieldValue: yieldNodes[1],
            },
            {
              itemScope: { name: 'Charlie', '@index': 2, '@type': 'iterator', '@item': { name: 'Charlie' } },
              yieldValue: yieldNodes[2],
            },
          ],
        })

        const inputData = [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }]

        let syncCallIndex = 0
        const syncValues = [inputData, 'Alice', 'Bob', 'Charlie']
        const mockInvoker = createMockInvoker({
          invokeSyncImpl: () => {
            const value = syncValues[syncCallIndex]
            syncCallIndex += 1
            return { value, metadata: { source: 'test', timestamp: Date.now() } }
          },
        })

        // Act
        const result = handler.evaluateSync(mockContext, mockInvoker)

        // Assert
        expect(result.value).toEqual(['Alice', 'Bob', 'Charlie'])
        expect(result.metadata).toEqual({ source: 'IterateHandler.map' })
      })

      it('should evaluate plain object yield values with nested AST nodes', () => {
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
        const labelNode = { id: 'runtime_ast:200', type: ASTNodeType.EXPRESSION }
        const valueNode = { id: 'runtime_ast:201', type: ASTNodeType.EXPRESSION }

        mockContext.runtimeExpansionState.preparedIterators.set(nodeId, {
          items: [
            {
              itemScope: {
                id: 'opt1',
                name: 'Option 1',
                '@index': 0,
                '@type': 'iterator',
                '@item': { id: 'opt1', name: 'Option 1' },
              },
              yieldValue: { label: labelNode, value: valueNode },
            },
            {
              itemScope: {
                id: 'opt2',
                name: 'Option 2',
                '@index': 1,
                '@type': 'iterator',
                '@item': { id: 'opt2', name: 'Option 2' },
              },
              yieldValue: { label: labelNode, value: valueNode },
            },
          ],
        })

        const inputData = [
          { id: 'opt1', name: 'Option 1' },
          { id: 'opt2', name: 'Option 2' },
        ]

        let syncCallIndex = 0
        const syncValues = [inputData, 'Option 1', 'opt1', 'Option 2', 'opt2']
        const mockInvoker = createMockInvoker({
          invokeSyncImpl: () => {
            const value = syncValues[syncCallIndex]
            syncCallIndex += 1
            return { value, metadata: { source: 'test', timestamp: Date.now() } }
          },
        })

        // Act
        const result = handler.evaluateSync(mockContext, mockInvoker)

        // Assert
        expect(result.value).toEqual([
          { label: 'Option 1', value: 'opt1' },
          { label: 'Option 2', value: 'opt2' },
        ])
      })

      it('should throw when cache is missing', () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const mockInvoker = createMockInvoker({
          invokeSyncImpl: () => ({
            value: [{ name: 'Alice' }],
            metadata: { source: 'test', timestamp: Date.now() },
          }),
        })

        // Act & Assert
        expect(() => handler.evaluateSync(mockContext, mockInvoker)).toThrow(
          'MAP iterator was not pre-expanded by RuntimeExpansionService',
        )
      })
    })

    describe('FILTER iterator', () => {
      it('should keep items where predicate evaluates to true', () => {
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

        let syncCallIndex = 0
        const syncValues = [inputData, true, false, true]
        const mockInvoker = createMockInvoker({
          invokeSyncImpl: () => {
            const value = syncValues[syncCallIndex]
            syncCallIndex += 1
            return { value, metadata: { source: 'test', timestamp: Date.now() } }
          },
        })

        vi.spyOn(TemplateFactory, 'instantiate').mockReturnValue(predicateNode)

        // Act
        const result = handler.evaluateSync(mockContext, mockInvoker)

        // Assert
        expect(result.value).toEqual([
          { id: 1, active: true },
          { id: 3, active: true },
        ])
        expect(result.metadata).toEqual({ source: 'IterateHandler.filter' })
      })
    })

    describe('FIND iterator', () => {
      it('should return first item where predicate evaluates to true', () => {
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

        let syncCallIndex = 0
        const syncValues = [inputData, false, true]
        const mockInvoker = createMockInvoker({
          invokeSyncImpl: () => {
            const value = syncValues[syncCallIndex]
            syncCallIndex += 1
            return { value, metadata: { source: 'test', timestamp: Date.now() } }
          },
        })

        vi.spyOn(TemplateFactory, 'instantiate').mockReturnValue(predicateNode)

        // Act
        const result = handler.evaluateSync(mockContext, mockInvoker)

        // Assert
        expect(result.value).toEqual({ id: 2, isTarget: true })
        expect(result.metadata).toEqual({ source: 'IterateHandler.find' })
      })
    })

    describe('common behavior', () => {
      it('should return empty array when input is empty array for MAP iterator', () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const mockInvoker = createMockInvoker({
          invokeSyncImpl: () => ({
            value: [],
            metadata: { source: 'test', timestamp: Date.now() },
          }),
        })

        // Act
        const result = handler.evaluateSync(mockContext, mockInvoker)

        // Assert
        expect(result.value).toEqual([])
        expect(result.metadata).toEqual({ source: 'IterateHandler.empty' })
      })

      it('should return empty array when input is undefined for MAP iterator', () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const mockInvoker = createMockInvoker({
          invokeSyncImpl: () => ({
            value: undefined,
            metadata: { source: 'test', timestamp: Date.now() },
          }),
        })

        // Act
        const result = handler.evaluateSync(mockContext, mockInvoker)

        // Assert
        expect(result.value).toEqual([])
        expect(result.metadata).toEqual({ source: 'IterateHandler.empty' })
      })

      it('should return empty array when input is null for MAP iterator', () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const mockInvoker = createMockInvoker({
          invokeSyncImpl: () => ({
            value: null,
            metadata: { source: 'test', timestamp: Date.now() },
          }),
        })

        // Act
        const result = handler.evaluateSync(mockContext, mockInvoker)

        // Assert
        expect(result.value).toEqual([])
        expect(result.metadata).toEqual({ source: 'IterateHandler.empty' })
      })

      it('should return undefined when input is undefined for FIND iterator', () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.FIND,
          predicate: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'active'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const mockInvoker = createMockInvoker({
          invokeSyncImpl: () => ({
            value: undefined,
            metadata: { source: 'test', timestamp: Date.now() },
          }),
        })

        // Act
        const result = handler.evaluateSync(mockContext, mockInvoker)

        // Assert
        expect(result.value).toBeUndefined()
        expect(result.metadata).toEqual({ source: 'IterateHandler.find.empty' })
      })

      it('should propagate error when input evaluation fails', () => {
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
          invokeSyncImpl: (): ThunkResult => errorResult,
        })

        // Act
        const result = handler.evaluateSync(mockContext, mockInvoker)

        // Assert
        expect(result.error).toEqual(errorResult.error)
      })

    })
  })

  describe('evaluate()', () => {
    describe('MAP iterator', () => {
      it('should evaluate each pre-expanded item from the cache', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const inputData = [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }]
        const yieldNodes = [
          { id: 'runtime_ast:100', type: ASTNodeType.EXPRESSION },
          { id: 'runtime_ast:101', type: ASTNodeType.EXPRESSION },
          { id: 'runtime_ast:102', type: ASTNodeType.EXPRESSION },
        ]

        mockContext.runtimeExpansionState.preparedIterators.set(nodeId, {
          items: [
            {
              itemScope: { name: 'Alice', '@index': 0, '@type': 'iterator', '@item': { name: 'Alice' } },
              yieldValue: yieldNodes[0],
            },
            {
              itemScope: { name: 'Bob', '@index': 1, '@type': 'iterator', '@item': { name: 'Bob' } },
              yieldValue: yieldNodes[1],
            },
            {
              itemScope: { name: 'Charlie', '@index': 2, '@type': 'iterator', '@item': { name: 'Charlie' } },
              yieldValue: yieldNodes[2],
            },
          ],
        })

        let syncCallIndex = 0
        const syncValues = ['Alice', 'Bob', 'Charlie']
        const mockInvoker = createMockInvoker({
          invokeImpl: async () => ({ value: inputData, metadata: { source: 'test', timestamp: Date.now() } }),
          invokeSyncImpl: () => {
            const value = syncValues[syncCallIndex]
            syncCallIndex += 1
            return { value, metadata: { source: 'test', timestamp: Date.now() } }
          },
        })

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker)

        // Assert
        expect(result.value).toEqual(['Alice', 'Bob', 'Charlie'])
        expect(result.metadata).toEqual({ source: 'IterateHandler.map' })
      })

      it('should use async invoke when template is async', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        const asyncRegistry = new FunctionRegistry()
        asyncRegistry.register({
          fetchData: { name: 'fetchData', evaluate: (): undefined => undefined, isAsync: true },
        })

        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: {
            type: ASTNodeType.EXPRESSION,
            expressionType: FunctionType.CONDITION,
            properties: { name: 'fetchData', arguments: [] },
          },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const deps = createMockMetadataDeps({
          thunkHandlerRegistry: {
            get: vi.fn().mockReturnValue({ isAsync: true }),
          } as any,
          functionRegistry: asyncRegistry,
        })
        handler.computeIsAsync(deps)

        const mockContext = createMockContext()
        const inputData = [{ name: 'Alice' }, { name: 'Bob' }]
        const yieldNodes = [
          { id: 'runtime_ast:100', type: ASTNodeType.EXPRESSION },
          { id: 'runtime_ast:101', type: ASTNodeType.EXPRESSION },
        ]

        mockContext.runtimeExpansionState.preparedIterators.set(nodeId, {
          items: [
            {
              itemScope: { name: 'Alice', '@index': 0, '@type': 'iterator', '@item': { name: 'Alice' } },
              yieldValue: yieldNodes[0],
            },
            {
              itemScope: { name: 'Bob', '@index': 1, '@type': 'iterator', '@item': { name: 'Bob' } },
              yieldValue: yieldNodes[1],
            },
          ],
        })

        const mockInvoker = createSequentialMockInvoker([inputData, 'Alice', 'Bob'])

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker)

        // Assert
        expect(result.value).toEqual(['Alice', 'Bob'])
        expect(mockInvoker.invoke).toHaveBeenCalledTimes(3)
        expect(mockInvoker.invokeSync).not.toHaveBeenCalled()
      })

      it('should throw when cache is missing', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const mockInvoker = createMockInvoker({ defaultValue: [{ name: 'Alice' }] })

        // Act & Assert
        await expect(handler.evaluate(mockContext, mockInvoker)).rejects.toThrow(
          'MAP iterator was not pre-expanded by RuntimeExpansionService',
        )
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

        vi.spyOn(TemplateFactory, 'instantiate').mockReturnValue(predicateNode)

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker)

        // Assert
        expect(result.value).toEqual([
          { id: 1, active: true },
          { id: 3, active: true },
        ])
        expect(result.metadata).toEqual({ source: 'IterateHandler.filter' })
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

        vi.spyOn(TemplateFactory, 'instantiate').mockReturnValue(predicateNode)

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker)

        // Assert
        expect(result.value).toEqual({ id: 2, isTarget: true })
        expect(result.metadata).toEqual({ source: 'IterateHandler.find' })
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

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker)

        // Assert
        expect(result.value).toEqual([])
        expect(result.metadata).toEqual({ source: 'IterateHandler.empty' })
      })

      it('should return empty array when input is undefined for MAP iterator', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const mockInvoker = createMockInvoker({ defaultValue: undefined })

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker)

        // Assert
        expect(result.value).toEqual([])
        expect(result.metadata).toEqual({ source: 'IterateHandler.empty' })
      })

      it('should return empty array when input is null for MAP iterator', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const mockInvoker = createMockInvoker({ defaultValue: null })

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker)

        // Assert
        expect(result.value).toEqual([])
        expect(result.metadata).toEqual({ source: 'IterateHandler.empty' })
      })

      it('should return undefined when input is undefined for FIND iterator', async () => {
        // Arrange
        const inputSourceId = 'compile_ast:1'
        const nodeId = 'compile_ast:2'
        iterateNode = createIterateNode(nodeId, inputSourceId, {
          type: IteratorType.FIND,
          predicate: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'active'] },
        })
        handler = new IterateHandler(nodeId, iterateNode)

        const mockContext = createMockContext()
        const mockInvoker = createMockInvoker({ defaultValue: undefined })

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker)

        // Assert
        expect(result.value).toBeUndefined()
        expect(result.metadata).toEqual({ source: 'IterateHandler.find.empty' })
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

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker)

        // Assert
        expect(result.error).toEqual(errorResult.error)
      })
    })
  })

})
