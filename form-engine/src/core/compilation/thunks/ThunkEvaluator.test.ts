import { when } from 'jest-when'
import { ASTNode, NodeId, PseudoNodeId, FormInstanceDependencies } from '@form-engine/core/types/engine.type'
import ThunkEvaluator from '@form-engine/core/compilation/thunks/ThunkEvaluator'
import ThunkHandlerRegistry from '@form-engine/core/compilation/registries/ThunkHandlerRegistry'
import DependencyGraph from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import NodeRegistry from '@form-engine/core/compilation/registries/NodeRegistry'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'
import ComponentRegistry from '@form-engine/registry/ComponentRegistry'
import { ThunkHandler, RuntimeOverlayBuilder, EvaluatorRequestData } from '@form-engine/core/compilation/thunks/types'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { CompilationDependencies } from '@form-engine/core/compilation/CompilationDependencies'
import MetadataRegistry from '@form-engine/core/compilation/registries/MetadataRegistry'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { createMockContext } from '@form-engine/test-utils/thunkTestHelpers'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'

// Mock NodeCompilationPipeline to prevent full compilation pipeline from running in tests
jest.mock('@form-engine/core/compilation/NodeCompilationPipeline', () => ({
  NodeCompilationPipeline: {
    normalize: jest.fn(),
    setRuntimeMetadata: jest.fn(),
    createPseudoNodes: jest.fn(),
    wireDependencies: jest.fn(),
  },
}))

/**
 * Create a mock ThunkHandler for testing
 */
function createMockHybridHandler(nodeId: NodeId, evaluateImpl: jest.Mock): jest.Mocked<ThunkHandler> {
  return {
    nodeId,
    isAsync: true,
    computeIsAsync: jest.fn(),
    evaluateSync: jest.fn(),
    evaluate: evaluateImpl,
  }
}

describe('ThunkEvaluator', () => {
  let evaluator: ThunkEvaluator
  let mockCompilationDependencies: jest.Mocked<CompilationDependencies>
  let mockFormInstanceDependencies: jest.Mocked<FormInstanceDependencies>
  let mockHandlerRegistry: jest.Mocked<ThunkHandlerRegistry>
  let mockDependencyGraph: jest.Mocked<DependencyGraph>
  let mockNodeRegistry: jest.Mocked<NodeRegistry>
  let mockMetadataRegistry: jest.Mocked<MetadataRegistry>
  let mockFunctionRegistry: jest.Mocked<FunctionRegistry>
  let mockComponentRegistry: jest.Mocked<ComponentRegistry>
  let mockLogger: jest.Mocked<Console>
  let mockRuntimeOverlayBuilder: RuntimeOverlayBuilder

  beforeEach(() => {
    ASTTestFactory.resetIds()

    mockRuntimeOverlayBuilder = {
      nodeRegistry: {} as NodeRegistry,
      handlerRegistry: {} as ThunkHandlerRegistry,
      metadataRegistry: {} as MetadataRegistry,
      dependencyGraph: {} as DependencyGraph,
      nodeFactory: { createNode: jest.fn() } as any,
      runtimeNodes: new Map(),
    }
    mockHandlerRegistry = {
      get: jest.fn(),
      register: jest.fn(),
      has: jest.fn(),
      size: jest.fn().mockReturnValue(0),
      getIds: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<ThunkHandlerRegistry>

    mockDependencyGraph = {
      topologicalSort: jest.fn().mockReturnValue({ sort: [], cycles: [], hasCycles: false }),
      addNode: jest.fn(),
      addEdge: jest.fn(),
    } as unknown as jest.Mocked<DependencyGraph>

    mockNodeRegistry = {
      get: jest.fn(),
      getAll: jest.fn().mockReturnValue(new Map()),
      getAllEntries: jest.fn(),
      getIds: jest.fn().mockReturnValue([]),
      has: jest.fn(),
      size: jest.fn(),
      register: jest.fn(),
      findByType: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<NodeRegistry>

    mockMetadataRegistry = {
      get: jest.fn(),
      set: jest.fn(),
    } as unknown as jest.Mocked<MetadataRegistry>

    mockCompilationDependencies = {
      thunkHandlerRegistry: mockHandlerRegistry,
      dependencyGraph: mockDependencyGraph,
      nodeRegistry: mockNodeRegistry,
      metadataRegistry: mockMetadataRegistry,
      createPendingView: jest.fn().mockImplementation(() => {
        const pendingNodeIds: NodeId[] = []
        const pendingNodes = new Map<NodeId, ASTNode>()
        const pendingNodeRegistry = {
          ...mockNodeRegistry,
          register: jest.fn().mockImplementation((id: NodeId, node: ASTNode) => {
            pendingNodeIds.push(id)
            pendingNodes.set(id, node)
          }),
          get: jest.fn().mockImplementation((id: NodeId) => pendingNodes.get(id) ?? mockNodeRegistry.get(id)),
          has: jest.fn().mockImplementation((id: NodeId) => pendingNodes.has(id) || mockNodeRegistry.has(id)),
        }

        return {
          deps: {
            nodeRegistry: pendingNodeRegistry,
            metadataRegistry: mockMetadataRegistry,
            dependencyGraph: mockDependencyGraph,
            thunkHandlerRegistry: mockHandlerRegistry,
          },
          flush: jest.fn(),
          getPendingNodeIds: () => pendingNodeIds,
        }
      }),
    } as unknown as jest.Mocked<CompilationDependencies>

    mockFunctionRegistry = {} as jest.Mocked<FunctionRegistry>

    mockComponentRegistry = {} as jest.Mocked<ComponentRegistry>

    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<Console>

    mockFormInstanceDependencies = {
      componentRegistry: mockComponentRegistry,
      functionRegistry: mockFunctionRegistry,
      logger: mockLogger,
      frameworkAdapter: {} as any,
    } as jest.Mocked<FormInstanceDependencies>

    evaluator = new ThunkEvaluator(mockCompilationDependencies, mockFormInstanceDependencies, mockRuntimeOverlayBuilder)
  })

  describe('invoke()', () => {
    const nodeId: NodeId = 'compile_ast:1'
    let mockContext: ThunkEvaluationContext

    beforeEach(() => {
      mockContext = createMockContext() as ThunkEvaluationContext
    })

    it('should return cached value result with cached flag when result is cached', async () => {
      // Arrange - use pseudo node ID since only pseudo nodes are cached
      const pseudoNodeId: NodeId = 'compile_pseudo:1'
      const mockHandler = createMockHybridHandler(
        pseudoNodeId,
        jest.fn().mockResolvedValue({
          value: 'test-value',
          metadata: { source: 'test', timestamp: 123456 },
        }),
      )

      when(mockHandlerRegistry.get).calledWith(pseudoNodeId).mockReturnValue(mockHandler)

      // Act
      const firstResult = await evaluator.invoke(pseudoNodeId, mockContext)

      // Assert
      expect(firstResult.value).toBe('test-value')
      expect(firstResult.metadata?.cached).toBeUndefined()
      expect(mockHandler.evaluate).toHaveBeenCalledTimes(1)

      // Act - Second call should use cache
      const secondResult = await evaluator.invoke(pseudoNodeId, mockContext)

      // Assert
      expect(secondResult.value).toBe('test-value')
      expect(secondResult.metadata?.cached).toBe(true)
      expect(secondResult.metadata?.source).toBe('test')
      expect(mockHandler.evaluate).toHaveBeenCalledTimes(1)
    })

    it('should return cached error result with cached flag when error result is cached', async () => {
      // Arrange - use pseudo node ID since only pseudo nodes are cached
      const pseudoNodeId: NodeId = 'compile_pseudo:2'
      const mockHandler = createMockHybridHandler(
        pseudoNodeId,
        jest.fn().mockResolvedValue({
          error: {
            type: 'EVALUATION_FAILED',
            nodeId: pseudoNodeId,
            message: 'Test error',
          },
          metadata: { source: 'test', timestamp: 123456 },
        }),
      )

      when(mockHandlerRegistry.get).calledWith(pseudoNodeId).mockReturnValue(mockHandler)

      // Act
      const firstResult = await evaluator.invoke(pseudoNodeId, mockContext)

      // Assert
      expect(firstResult.error).toBeDefined()
      expect(firstResult.error?.message).toBe('Test error')
      expect(firstResult.metadata?.cached).toBeUndefined()

      // Act - Second call should use cached error
      const secondResult = await evaluator.invoke(pseudoNodeId, mockContext)

      // Assert
      expect(secondResult.error).toBeDefined()
      expect(secondResult.error?.message).toBe('Test error')
      expect(secondResult.metadata?.cached).toBe(true)
      expect(mockHandler.evaluate).toHaveBeenCalledTimes(1)
    })

    it('should throw HANDLER_NOT_FOUND error when handler not found', async () => {
      // Arrange
      when(mockHandlerRegistry.get).calledWith(nodeId).mockReturnValue(undefined)

      // Act & Assert
      await expect(evaluator.invoke(nodeId, mockContext)).rejects.toThrow('No handler registered')
    })

    it('should execute handler and cache result when handler evaluates successfully', async () => {
      // Arrange
      const mockHandler = createMockHybridHandler(
        nodeId,
        jest.fn().mockResolvedValue({
          value: 42,
          metadata: { source: 'handler', timestamp: Date.now() },
        }),
      )

      when(mockHandlerRegistry.get).calledWith(nodeId).mockReturnValue(mockHandler)

      // Act
      const result = await evaluator.invoke(nodeId, mockContext)

      // Assert
      expect(result.value).toBe(42)
      expect(result.error).toBeUndefined()
      expect(result.metadata.source).toBe('handler')
      expect(mockHandler.evaluate).toHaveBeenCalledWith(
        mockContext,
        evaluator,
        expect.objectContaining({
          transformValue: expect.any(Function),
          registerRuntimeNodesBatch: expect.any(Function),
        }),
      )
    })

    it('should let handler exceptions bubble up', async () => {
      // Arrange
      const thrownError = new Error('Handler crashed')
      const mockHandler = createMockHybridHandler(nodeId, jest.fn().mockRejectedValue(thrownError))

      when(mockHandlerRegistry.get).calledWith(nodeId).mockReturnValue(mockHandler)

      // Act & Assert
      await expect(evaluator.invoke(nodeId, mockContext)).rejects.toThrow('Handler crashed')
    })

    it('should let non-Error exceptions bubble up', async () => {
      // Arrange
      const mockHandler = createMockHybridHandler(nodeId, jest.fn().mockRejectedValue('String error'))

      when(mockHandlerRegistry.get).calledWith(nodeId).mockReturnValue(mockHandler)

      // Act & Assert
      await expect(evaluator.invoke(nodeId, mockContext)).rejects.toBe('String error')
    })

    it('should dedupe concurrent invocations of the same node', async () => {
      // Arrange
      let resolveEvaluation: (value: unknown) => void
      const evaluationPromise = new Promise(resolve => {
        resolveEvaluation = resolve
      })

      const mockHandler = createMockHybridHandler(
        nodeId,
        jest.fn().mockImplementation(async () => {
          await evaluationPromise

          return {
            value: 'shared-result',
            metadata: { source: 'OMGWTFBBQ', timestamp: 123456 },
          }
        }),
      )

      when(mockHandlerRegistry.get).calledWith(nodeId).mockReturnValue(mockHandler)

      // Act
      const promise1 = evaluator.invoke(nodeId, mockContext)
      const promise2 = evaluator.invoke(nodeId, mockContext)
      const promise3 = evaluator.invoke(nodeId, mockContext)

      resolveEvaluation!(undefined)

      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3])

      // Assert
      expect(mockHandler.evaluate).toHaveBeenCalledTimes(1)
      expect(result1.value).toBe('shared-result')
      expect(result2.value).toBe('shared-result')
      expect(result3.value).toBe('shared-result')
    })
  })

  describe('createContext()', () => {
    it('should build context from request data', () => {
      // Arrange
      const request: EvaluatorRequestData = {
        method: 'GET',
        post: { email: 'test@example.com' },
        query: { returnUrl: '/dashboard' },
        params: { id: '123' },
      }

      // Act
      const context = evaluator.createContext(request)

      // Assert
      expect(context.request.post).toBe(request.post)
      expect(context.request.query).toBe(request.query)
      expect(context.request.params).toBe(request.params)
      expect(context.global.data).toEqual({})
      expect(context.global.answers).toEqual({})
      expect(context.functionRegistry).toBe(mockFunctionRegistry)
      expect(context.logger).toBe(mockLogger)
    })
  })

  describe('evaluate()', () => {

    it('should invoke Journey node which invokes its children via lazy evaluation', async () => {
      // Arrange
      const journeyNodeId: NodeId = 'compile_ast:100'
      const childNode1: NodeId = 'compile_ast:101'
      const childNode2: NodeId = 'compile_ast:102'

      const request: EvaluatorRequestData = {
        method: 'GET',
        post: {},
        query: {},
        params: {},
      }

      const journeyNode = ASTTestFactory.journey().withId(journeyNodeId).build()

      // Mock findByType to return the Journey node
      when(mockNodeRegistry.findByType).calledWith(ASTNodeType.JOURNEY).mockReturnValue([journeyNode])

      const evaluationOrder: NodeId[] = []

      const createHandler = (id: NodeId, childIds: NodeId[] = []): jest.Mocked<ThunkHandler> => {
        return {
          nodeId: id,
          isAsync: true,
          computeIsAsync: jest.fn(),
          evaluateSync: jest.fn(),
          evaluate: jest.fn().mockImplementation(async (ctx, invoker, hooks) => {
            evaluationOrder.push(id)

            // Simulate handler invoking its children sequentially

            for (const childId of childIds) {
              // eslint-disable-next-line no-await-in-loop
              await invoker.invoke(childId, ctx, hooks)
            }

            return {
              value: `result-${id}`,
              metadata: {},
            }
          }),
        }
      }

      const journeyHandler = createHandler(journeyNodeId, [childNode1, childNode2])
      const childHandler1 = createHandler(childNode1)
      const childHandler2 = createHandler(childNode2)

      when(mockHandlerRegistry.get).calledWith(journeyNodeId).mockReturnValue(journeyHandler)
      when(mockHandlerRegistry.get).calledWith(childNode1).mockReturnValue(childHandler1)
      when(mockHandlerRegistry.get).calledWith(childNode2).mockReturnValue(childHandler2)

      // Act
      const context = evaluator.createContext(request)
      await evaluator.evaluate(context)

      // Assert - Journey should be evaluated first, then its children
      expect(evaluationOrder).toEqual([journeyNodeId, childNode1, childNode2])
      expect(journeyHandler.evaluate).toHaveBeenCalledTimes(1)
      expect(childHandler1.evaluate).toHaveBeenCalledTimes(1)
      expect(childHandler2.evaluate).toHaveBeenCalledTimes(1)
    })

    it('should not share cache between evaluator instances', async () => {
      // Arrange
      const journeyNodeId: NodeId = 'compile_ast:200'
      const childNodeId: NodeId = 'compile_ast:201'
      const request: EvaluatorRequestData = {
        method: 'GET',
        post: {},
        query: {},
        params: {},
      }

      const journeyNode = ASTTestFactory.journey().withId(journeyNodeId).build()

      when(mockNodeRegistry.findByType).calledWith(ASTNodeType.JOURNEY).mockReturnValue([journeyNode])

      let callCount = 0

      const journeyHandler = createMockHybridHandler(
        journeyNodeId,
        jest.fn().mockImplementation(async (ctx, invoker) => {
          await invoker.invoke(childNodeId, ctx)

          return { value: 'journey', metadata: {} }
        }),
      )

      const childHandler = createMockHybridHandler(
        childNodeId,
        jest.fn().mockImplementation(async () => {
          callCount += 1

          return { value: `value-${callCount}`, metadata: {} }
        }),
      )

      when(mockHandlerRegistry.get).calledWith(journeyNodeId).mockReturnValue(journeyHandler)
      when(mockHandlerRegistry.get).calledWith(childNodeId).mockReturnValue(childHandler)

      // Act - First evaluator instance
      const evaluator1 = new ThunkEvaluator(
        mockCompilationDependencies,
        mockFormInstanceDependencies,
        mockRuntimeOverlayBuilder,
      )
      await evaluator1.evaluate(evaluator1.createContext(request))

      // Assert - First evaluation
      expect(callCount).toBe(1)

      // Act - Second evaluator instance (simulating new request)
      const evaluator2 = new ThunkEvaluator(
        mockCompilationDependencies,
        mockFormInstanceDependencies,
        mockRuntimeOverlayBuilder,
      )
      await evaluator2.evaluate(evaluator2.createContext(request))

      // Assert - Handler should be called again (not using evaluator1's cache)
      expect(callCount).toBe(2)
    })

    it('should populate answers map during evaluation', async () => {
      // Arrange
      const journeyNodeId: NodeId = 'compile_ast:300'
      const answerNodeId: PseudoNodeId = 'compile_pseudo:301'
      const request: EvaluatorRequestData = {
        method: 'GET',
        post: {},
        query: {},
        params: {},
      }

      const journeyNode = ASTTestFactory.journey().withId(journeyNodeId).build()

      when(mockNodeRegistry.findByType).calledWith(ASTNodeType.JOURNEY).mockReturnValue([journeyNode])

      const journeyHandler = createMockHybridHandler(
        journeyNodeId,
        jest.fn().mockImplementation(async (ctx, invoker) => {
          await invoker.invoke(answerNodeId, ctx)

          return {
            value: 'journey',
            metadata: {},
          }
        }),
      )

      const answerHandler = createMockHybridHandler(
        answerNodeId,
        jest.fn().mockImplementation(async (ctx: ThunkEvaluationContext) => {
          // Simulate handler populating answers
          ctx.global.answers.email = {
            current: 'test@example.com',
            mutations: [{ value: 'test@example.com', source: 'post' }],
          }

          return {
            value: 'test@example.com',
            metadata: {},
          }
        }),
      )

      when(mockHandlerRegistry.get).calledWith(journeyNodeId).mockReturnValue(journeyHandler)
      when(mockHandlerRegistry.get).calledWith(answerNodeId).mockReturnValue(answerHandler)

      // Act
      const context = evaluator.createContext(request)
      await evaluator.evaluate(context)

      // Assert
      expect(context.global.answers.email).toEqual({
        current: 'test@example.com',
        mutations: [{ value: 'test@example.com', source: 'post' }],
      })
    })
  })
})
