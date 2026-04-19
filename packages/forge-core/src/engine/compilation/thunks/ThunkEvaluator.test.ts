import { when } from 'vitest-when'
import { ASTNode, NodeId, JourneyInstanceDependencies } from '../../types/engine.type'
import ThunkEvaluator from './ThunkEvaluator'
import ThunkHandlerRegistry from '../registries/ThunkHandlerRegistry'
import NodeRegistry from '../registries/NodeRegistry'
import FunctionRegistry from '../../registries/FunctionRegistry'
import ComponentRegistry from '../../registries/ComponentRegistry'
import { ThunkHandler, RuntimeOverlayBuilder } from './types'
import type { StepRequest } from '../../../framework/types/request.type'
import type { StepResponse, CookieMutation, CookieOptions } from '../../../framework/types/response.type'
import { CompilationDependencies } from '../CompilationDependencies'
import MetadataRegistry from '../registries/MetadataRegistry'
import ThunkEvaluationContext from './ThunkEvaluationContext'
import { createMockContext } from '../../../testing/thunkTestHelpers'
import { ASTTestFactory } from '../../../testing/ASTTestFactory'

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

  const url = overrides.url ?? 'http://localhost/test'

  return {
    method: overrides.method ?? 'GET',
    url,
    baseUrl: '',
    location: {
      origin: 'http://localhost',
      href: url,
      pathname: '/test',
      basePath: '',
    },

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
vi.mock('../NodeCompilationPipeline', () => ({
  NodeCompilationPipeline: {
    normalize: vi.fn(),
    setRuntimeMetadata: vi.fn(),
    createPseudoNodes: vi.fn(),
    wireDependencies: vi.fn(),
  },
}))

/**
 * Create a mock ThunkHandler for testing
 */
function createMockHybridHandler(nodeId: NodeId, evaluateImpl: Mock): Mocked<ThunkHandler> {
  return {
    nodeId,
    isAsync: true,
    computeIsAsync: vi.fn(),
    evaluateSync: vi.fn(),
    evaluate: evaluateImpl,
  }
}

describe('ThunkEvaluator', () => {
  let evaluator: ThunkEvaluator
  let mockCompilationDependencies: Mocked<CompilationDependencies>
  let mockJourneyInstanceDependencies: Mocked<JourneyInstanceDependencies>
  let mockHandlerRegistry: Mocked<ThunkHandlerRegistry>
  let mockNodeRegistry: Mocked<NodeRegistry>
  let mockMetadataRegistry: Mocked<MetadataRegistry>
  let mockFunctionRegistry: Mocked<FunctionRegistry>
  let mockComponentRegistry: Mocked<ComponentRegistry>
  let mockLogger: Mocked<Console>
  let mockRuntimeOverlayBuilder: RuntimeOverlayBuilder

  beforeEach(() => {
    ASTTestFactory.resetIds()

    mockRuntimeOverlayBuilder = {
      nodeRegistry: {} as NodeRegistry,
      handlerRegistry: {} as ThunkHandlerRegistry,
      metadataRegistry: {} as MetadataRegistry,
      nodeFactory: { createNode: vi.fn() } as any,
      runtimeNodes: new Map(),
    }
    mockHandlerRegistry = {
      get: vi.fn(),
      register: vi.fn(),
      has: vi.fn(),
      size: vi.fn().mockReturnValue(0),
      getIds: vi.fn().mockReturnValue([]),
    } as unknown as Mocked<ThunkHandlerRegistry>

    mockNodeRegistry = {
      get: vi.fn(),
      getAll: vi.fn().mockReturnValue(new Map()),
      getAllEntries: vi.fn(),
      getIds: vi.fn().mockReturnValue([]),
      has: vi.fn(),
      size: vi.fn(),
      register: vi.fn(),
      findByType: vi.fn().mockReturnValue([]),
    } as unknown as Mocked<NodeRegistry>

    mockMetadataRegistry = {
      get: vi.fn(),
      set: vi.fn(),
    } as unknown as Mocked<MetadataRegistry>

    mockCompilationDependencies = {
      thunkHandlerRegistry: mockHandlerRegistry,
      nodeRegistry: mockNodeRegistry,
      metadataRegistry: mockMetadataRegistry,
      createPendingView: vi.fn().mockImplementation(() => {
        const pendingNodeIds: NodeId[] = []
        const pendingNodes = new Map<NodeId, ASTNode>()
        const pendingNodeRegistry = {
          ...mockNodeRegistry,
          register: vi.fn().mockImplementation((id: NodeId, node: ASTNode) => {
            pendingNodeIds.push(id)
            pendingNodes.set(id, node)
          }),
          get: vi.fn().mockImplementation((id: NodeId) => pendingNodes.get(id) ?? mockNodeRegistry.get(id)),
          has: vi.fn().mockImplementation((id: NodeId) => pendingNodes.has(id) || mockNodeRegistry.has(id)),
        }

        return {
          deps: {
            nodeRegistry: pendingNodeRegistry,
            metadataRegistry: mockMetadataRegistry,
            thunkHandlerRegistry: mockHandlerRegistry,
          },
          flush: vi.fn(),
          getPendingNodeIds: () => pendingNodeIds,
        }
      }),
    } as unknown as Mocked<CompilationDependencies>

    mockFunctionRegistry = {} as Mocked<FunctionRegistry>

    mockComponentRegistry = {} as Mocked<ComponentRegistry>

    mockLogger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Mocked<Console>

    mockJourneyInstanceDependencies = {
      componentRegistry: mockComponentRegistry,
      functionRegistry: mockFunctionRegistry,
      logger: mockLogger,
      frameworkAdapter: {} as any,
    } as Mocked<JourneyInstanceDependencies>

    evaluator = new ThunkEvaluator(
      mockCompilationDependencies,
      mockJourneyInstanceDependencies,
      mockRuntimeOverlayBuilder,
    )
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
        vi.fn().mockResolvedValue({
          value: 'test-value',
          metadata: { source: 'test', timestamp: 123456 },
        }),
      )

      when(mockHandlerRegistry.get).calledWith(pseudoNodeId).thenReturn(mockHandler)

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
        vi.fn().mockResolvedValue({
          error: {
            type: 'EVALUATION_FAILED',
            nodeId: pseudoNodeId,
            message: 'Test error',
          },
          metadata: { source: 'test', timestamp: 123456 },
        }),
      )

      when(mockHandlerRegistry.get).calledWith(pseudoNodeId).thenReturn(mockHandler)

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
      when(mockHandlerRegistry.get).calledWith(nodeId).thenReturn(undefined)

      // Act & Assert
      await expect(evaluator.invoke(nodeId, mockContext)).rejects.toThrow('No handler registered')
    })

    it('should execute handler and cache result when handler evaluates successfully', async () => {
      // Arrange
      const mockHandler = createMockHybridHandler(
        nodeId,
        vi.fn().mockResolvedValue({
          value: 42,
          metadata: { source: 'handler', timestamp: Date.now() },
        }),
      )

      when(mockHandlerRegistry.get).calledWith(nodeId).thenReturn(mockHandler)

      // Act
      const result = await evaluator.invoke(nodeId, mockContext)

      // Assert
      expect(result.value).toBe(42)
      expect(result.error).toBeUndefined()
      expect(result.metadata!.source).toBe('handler')
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
      const mockHandler = createMockHybridHandler(nodeId, vi.fn().mockRejectedValue(thrownError))

      when(mockHandlerRegistry.get).calledWith(nodeId).thenReturn(mockHandler)

      // Act & Assert
      await expect(evaluator.invoke(nodeId, mockContext)).rejects.toThrow('Handler crashed')
    })

    it('should let non-Error exceptions bubble up', async () => {
      // Arrange
      const mockHandler = createMockHybridHandler(nodeId, vi.fn().mockRejectedValue('String error'))

      when(mockHandlerRegistry.get).calledWith(nodeId).thenReturn(mockHandler)

      // Act & Assert
      await expect(evaluator.invoke(nodeId, mockContext)).rejects.toBe('String error')
    })

    it('should throw when handler returns TYPE_MISMATCH error', async () => {
      // Arrange
      const cause = new Error('type mismatch in greaterThan')
      const mockHandler = createMockHybridHandler(
        nodeId,
        vi.fn().mockResolvedValue({
          error: {
            type: 'TYPE_MISMATCH',
            nodeId,
            message: 'type mismatch in greaterThan',
            cause,
          },
        }),
      )

      when(mockHandlerRegistry.get).calledWith(nodeId).thenReturn(mockHandler)

      // Act & Assert
      await expect(evaluator.invoke(nodeId, mockContext)).rejects.toThrow('type mismatch in greaterThan')
    })

    it('should throw when sync handler returns TYPE_MISMATCH error via invoke()', async () => {
      // Arrange
      const cause = new Error('type mismatch in trim')
      const syncHandler: Mocked<ThunkHandler> = {
        nodeId,
        isAsync: false,
        computeIsAsync: vi.fn(),
        evaluateSync: vi.fn().mockReturnValue({
          error: {
            type: 'TYPE_MISMATCH',
            nodeId,
            message: 'type mismatch in trim',
            cause,
          },
        }),
        evaluate: vi.fn(),
      }

      when(mockHandlerRegistry.get).calledWith(nodeId).thenReturn(syncHandler)

      // Act & Assert
      await expect(evaluator.invoke(nodeId, mockContext)).rejects.toThrow('type mismatch in trim')
    })

    it('should not throw for EVALUATION_FAILED errors', async () => {
      // Arrange
      const mockHandler = createMockHybridHandler(
        nodeId,
        vi.fn().mockResolvedValue({
          error: {
            type: 'EVALUATION_FAILED',
            nodeId,
            message: 'Division by zero',
          },
        }),
      )

      when(mockHandlerRegistry.get).calledWith(nodeId).thenReturn(mockHandler)

      // Act
      const result = await evaluator.invoke(nodeId, mockContext)

      // Assert
      expect(result.error).toBeDefined()
      expect(result.error?.type).toBe('EVALUATION_FAILED')
    })
  })

  describe('invokeSync()', () => {
    const nodeId: NodeId = 'compile_ast:1'
    let mockContext: ThunkEvaluationContext

    beforeEach(() => {
      mockContext = createMockContext() as ThunkEvaluationContext
    })

    it('should throw when handler returns TYPE_MISMATCH error', () => {
      // Arrange
      const cause = new Error('type mismatch in greaterThan')
      const syncHandler: Mocked<ThunkHandler> = {
        nodeId,
        isAsync: false,
        computeIsAsync: vi.fn(),
        evaluateSync: vi.fn().mockReturnValue({
          error: {
            type: 'TYPE_MISMATCH',
            nodeId,
            message: 'type mismatch in greaterThan',
            cause,
          },
        }),
        evaluate: vi.fn(),
      }

      when(mockHandlerRegistry.get).calledWith(nodeId).thenReturn(syncHandler)

      // Act & Assert
      expect(() => evaluator.invokeSync(nodeId, mockContext)).toThrow('type mismatch in greaterThan')
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
