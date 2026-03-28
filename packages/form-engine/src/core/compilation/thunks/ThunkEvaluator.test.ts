import { when } from 'jest-when'
import { ASTNode, NodeId, FormInstanceDependencies } from '@form-engine/core/types/engine.type'
import ThunkEvaluator from '@form-engine/core/compilation/thunks/ThunkEvaluator'
import ThunkHandlerRegistry from '@form-engine/core/compilation/registries/ThunkHandlerRegistry'
import NodeRegistry from '@form-engine/core/compilation/registries/NodeRegistry'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'
import ComponentRegistry from '@form-engine/registry/ComponentRegistry'
import { ThunkHandler, RuntimeOverlayBuilder } from '@form-engine/core/compilation/thunks/types'
import { StepRequest, StepResponse, CookieMutation, CookieOptions } from '@form-engine/core/runtime/routes/types'
import { CompilationDependencies } from '@form-engine/core/compilation/CompilationDependencies'
import MetadataRegistry from '@form-engine/core/compilation/registries/MetadataRegistry'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { createMockContext } from '@form-engine/test-utils/thunkTestHelpers'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'

const createTestRequest = (
  overrides: Partial<{
    method: 'GET' | 'POST'
    url: string
    session: unknown
    state: Record<string, unknown>
    headers: Record<string, string | string[] | undefined>
    cookies: Record<string, string | undefined>
    params: Record<string, string>
    query: Record<string, string | string[]>
    post: Record<string, string | string[]>
  }> = {},
): StepRequest => {
  const headers = overrides.headers ?? {}
  const cookies = overrides.cookies ?? {}
  const params = overrides.params ?? {}
  const query = overrides.query ?? {}
  const post = overrides.post ?? {}
  const session = overrides.session
  const state = overrides.state ?? {}

  return {
    method: overrides.method ?? 'GET',
    url: overrides.url ?? 'http://localhost/test',

    getHeader: (name: string) => headers[name.toLowerCase()],
    getAllHeaders: () => headers,
    getCookie: (name: string) => cookies[name],
    getAllCookies: () => cookies,
    getParam: (name: string) => params[name],
    getParams: () => params,
    getQuery: (name: string) => query[name],
    getAllQuery: () => query,
    getPost: (name: string) => post[name],
    getAllPost: () => post,
    getSession: () => session,
    getState: (key: string) => state[key],
    getAllState: () => state,
  }
}

const createTestResponse = (): StepResponse => {
  const responseHeaders = new Map<string, string>()
  const responseCookies = new Map<string, CookieMutation>()

  return {
    setHeader: (name: string, value: string) => {
      responseHeaders.set(name, value)
    },
    getHeader: (name: string) => responseHeaders.get(name),
    getAllHeaders: () => responseHeaders,
    setCookie: (name: string, value: string, options?: CookieOptions) => {
      responseCookies.set(name, { value, options })
    },
    getCookie: (name: string) => responseCookies.get(name),
    getAllCookies: () => responseCookies,
  }
}

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

    it('should return cached value result on second call', async () => {
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
      expect(mockHandler.evaluate).toHaveBeenCalledTimes(1)

      // Act - Second call should use cache
      const secondResult = await evaluator.invoke(pseudoNodeId, mockContext)

      // Assert
      expect(secondResult.value).toBe('test-value')
      expect(secondResult.metadata?.source).toBe('test')
      expect(mockHandler.evaluate).toHaveBeenCalledTimes(1)
    })

    it('should return cached error result on second call', async () => {
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

      // Act - Second call should use cached error
      const secondResult = await evaluator.invoke(pseudoNodeId, mockContext)

      // Assert
      expect(secondResult.error).toBeDefined()
      expect(secondResult.error?.message).toBe('Test error')
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
  })

  describe('createContext()', () => {
    it('should build context from request data', () => {
      // Arrange
      const request = createTestRequest({
        post: { email: 'test@example.com' },
        query: { returnUrl: '/dashboard' },
        params: { id: '123' },
      })
      const response = createTestResponse()

      // Act
      const context = evaluator.createContext(request, response)

      // Assert
      expect(context.request.getPost('email')).toBe('test@example.com')
      expect(context.request.getQuery('returnUrl')).toBe('/dashboard')
      expect(context.request.getParam('id')).toBe('123')
      expect(context.global.data).toEqual({})
      expect(context.global.answers).toEqual({})
      expect(context.functionRegistry).toBe(mockFunctionRegistry)
      expect(context.logger).toBe(mockLogger)
    })
  })
})
