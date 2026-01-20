import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import { PseudoNode } from '@form-engine/core/types/pseudoNodes.type'
import { IndexableNodeType } from '@form-engine/core/compilation/registries/NodeRegistry'
import ThunkEvaluationContext, {
  ThunkEvaluationGlobalState,
} from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import {
  AnswerHistory,
  AnswerSource,
  ThunkErrorType,
  ThunkInvocationAdapter,
  ThunkResult,
  ThunkRuntimeHooks,
} from '@form-engine/core/compilation/thunks/types'
import { StepRequest } from '@form-engine/core/runtime/routes/types'

/**
 * Mock answer input - can be a simple value or a full AnswerHistory
 * Simple values are converted to AnswerHistory with source 'load'
 */
export type MockAnswerInput = unknown | AnswerHistory

/**
 * Check if a value is an AnswerHistory (has current and mutations properties)
 */
function isAnswerHistory(input: unknown): input is AnswerHistory {
  return typeof input === 'object' &&
    input !== null &&
    'current' in input &&
    'mutations' in input &&
    Array.isArray((input as AnswerHistory).mutations)
}

/**
 * Convert mock answer input to AnswerHistory
 * If already an AnswerHistory, return as-is. Otherwise wrap with default source 'load'.
 */
function toAnswerHistory(input: MockAnswerInput, defaultSource: AnswerSource = 'load'): AnswerHistory {
  if (isAnswerHistory(input)) {
    return input
  }

  return { current: input, mutations: [{ value: input, source: defaultSource }] }
}

/**
 * Options for creating a mock ThunkEvaluationContext
 */
export interface MockContextOptions {
  mockRequest?: Partial<StepRequest>
  mockData?: Record<string, unknown>
  /**
   * Mock answers - can be simple values or full AnswerHistory objects.
   * Simple values are converted to AnswerHistory with source 'load'.
   *
   * @example
   * // Simple value (source defaults to 'load')
   * mockAnswers: { email: 'test@example.com' }
   *
   * // Full AnswerHistory (explicit mutations)
   * mockAnswers: { email: { current: 'test@example.com', mutations: [{ value: 'test@example.com', source: 'action' }] } }
   */
  mockAnswers?: Record<string, MockAnswerInput>
  mockScope?: Record<string, unknown>[]
  mockNodes?: Map<NodeId, ASTNode | PseudoNode>
  mockRegisteredFunctions?: Map<string, any>
  /**
   * Mock metadata - key is nodeId, value is a record of metadata key-values
   *
   * @example
   * mockMetadata: new Map([
   *   ['compile_ast:1', { isDescendantOfStep: true, isCurrentStep: false }],
   * ])
   */
  mockMetadata?: Map<NodeId, Record<string, unknown>>
}

/**
 * Create a mock ThunkEvaluationContext for testing
 *
 * @returns A mock ThunkEvaluationContext instance
 *
 * @example
 * const context = createMockContext({
 *   mockRequest: {
 *     post: { email: 'test@example.com' },
 *     query: { returnUrl: '/dashboard' },
 *   },
 *   mockAnswers: { businessType: 'food-stall' },
 *   mockRegisteredFunctions: new Map([
 *     ['uppercase', (str: string) => str.toUpperCase()],
 *     ['lowercase', (str: string) => str.toLowerCase()],
 *   ]),
 * })
 * @param options
 */
export function createMockContext(options: MockContextOptions = {}): ThunkEvaluationContext {
  const request: StepRequest = {
    method: options.mockRequest?.method ?? 'GET',
    post: options.mockRequest?.post ?? {},
    query: options.mockRequest?.query ?? {},
    params: options.mockRequest?.params ?? {},
    url: options.mockRequest?.url ?? 'http://localhost/mock-path',
    session: options.mockRequest?.session,
    state: options.mockRequest?.state,
  }

  // Convert mockAnswers to AnswerHistory format
  const answers: Record<string, AnswerHistory> = {}

  if (options.mockAnswers) {
    Object.entries(options.mockAnswers).forEach(([key, value]) => {
      answers[key] = toAnswerHistory(value)
    })
  }

  const global: ThunkEvaluationGlobalState = {
    data: options.mockData ?? {},
    answers,
  }

  const scope = options.mockScope ?? []

  const findFieldByCode = jest.fn()

  const mockFunctionRegistry = {
    has: jest.fn((name: string) => options.mockRegisteredFunctions?.has(name) ?? false),
    get: jest.fn((name: string) => options.mockRegisteredFunctions?.get(name)),
    getAll: jest.fn(() => options.mockRegisteredFunctions ?? new Map()),
  }

  const mockNodeRegistry = {
    getAll: jest.fn(() => options.mockNodes ?? new Map()),
    get: jest.fn((nodeId: NodeId) => options.mockNodes?.get(nodeId)),
    has: jest.fn((nodeId: NodeId) => options.mockNodes?.has(nodeId) ?? false),
    findByType: jest.fn((type: IndexableNodeType) => {
      if (!options.mockNodes) {
        return []
      }

      const results: (ASTNode | PseudoNode)[] = []

      options.mockNodes.forEach(node => {
        if (node.type === type) {
          results.push(node)
        }
      })

      return results
    }),
  }

  // Mock metadataRegistry - by default, treat all nodes as on the current step
  const mockMetadataRegistry = {
    get: jest.fn((nodeId: NodeId, key: string, defaultValue?: unknown) => {
      const nodeMetadata = options.mockMetadata?.get(nodeId)

      if (nodeMetadata && key in nodeMetadata) {
        return nodeMetadata[key]
      }

      // Default behavior: treat all nodes as on current step (for backwards compatibility)
      // This ensures existing tests continue to work without needing to specify metadata
      if (key === 'isDescendantOfStep' || key === 'isCurrentStep' || key === 'isAncestorOfStep') {
        return true
      }

      return defaultValue
    }),
    set: jest.fn(),
    has: jest.fn((nodeId: NodeId, key: string) => {
      const nodeMetadata = options.mockMetadata?.get(nodeId)
      return nodeMetadata ? key in nodeMetadata : false
    }),
    findNodesWhere: jest.fn((): NodeId[] => []),
  }

  return {
    request,
    global,
    scope,
    findFieldByCode,
    nodeRegistry: mockNodeRegistry,
    metadataRegistry: mockMetadataRegistry,
    functionRegistry: mockFunctionRegistry,
    logger: console,
    withIsolatedScope: jest.fn().mockImplementation(function withIsolatedScopeMock(this: any) {
      // Create a shallow clone with the same global state but new scope array
      const clone = {
        ...this,
        scope: [...this.scope],
      }

      // Ensure the clone also has withIsolatedScope
      clone.withIsolatedScope = this.withIsolatedScope

      return clone
    }),
  } as any
}

/**
 * Options for creating a mock ThunkInvocationAdapter
 */
export interface MockInvokerOptions {
  /**
   * Default return value for invoke calls
   * Can be overridden with returnValueMap
   */
  defaultValue?: unknown

  /**
   * Map of nodeId to return value for specific nodes
   */
  returnValueMap?: Map<NodeId, unknown>

  /**
   * Custom invoke implementation
   */
  invokeImpl?: (nodeId: NodeId, context: ThunkEvaluationContext, hooks: ThunkRuntimeHooks) => Promise<ThunkResult>

  /**
   * Custom invokeSync implementation
   */
  invokeSyncImpl?: (nodeId: NodeId, context: ThunkEvaluationContext) => ThunkResult
}

/**
 * Create a mock ThunkInvocationAdapter for testing
 *
 * @param options - Customization options for the mock invoker
 * @returns A mock ThunkInvocationAdapter
 *
 * @example
 * // Simple mock with default value
 * const invoker = createMockInvoker({ defaultValue: 'test' })
 *
 * @example
 * // Mock with specific return values per node
 * const invoker = createMockInvoker({
 *   returnValueMap: new Map([
 *     ['compile_ast:1', 'value1'],
 *     ['compile_ast:2', 'value2'],
 *   ])
 * })
 *
 * @example
 * // Mock with custom implementation
 * const invoker = createMockInvoker({
 *   invokeImpl: async (nodeId) => ({
 *     value: `evaluated-${nodeId}`,
 *     metadata: { source: 'test', timestamp: Date.now() }
 *   })
 * })
 */
export function createMockInvoker(options: MockInvokerOptions = {}): jest.Mocked<ThunkInvocationAdapter> {
  const defaultImpl = async (
    nodeId: NodeId,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: ThunkEvaluationContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    hooks: ThunkRuntimeHooks,
  ): Promise<ThunkResult> => {
    let value = options.defaultValue

    if (options.returnValueMap?.has(nodeId)) {
      value = options.returnValueMap.get(nodeId)
    }

    return {
      value,
      metadata: {
        source: 'mockInvoker',
        timestamp: Date.now(),
      },
    }
  }

  // invokeSync implementation - returns result directly (no Promise)
  const defaultSyncImpl = (nodeId: NodeId) => {
    const value = options.returnValueMap?.get(nodeId) ?? options.defaultValue

    return {
      value,
      metadata: {
        source: 'mockInvoker',
        timestamp: Date.now(),
      },
    }
  }

  return {
    invoke: jest.fn().mockImplementation(options.invokeImpl ?? defaultImpl),
    invokeSync: jest.fn().mockImplementation(options.invokeSyncImpl ?? defaultSyncImpl),
  }
}

/**
 * Create a mock invoker that returns sequential values from an array
 *
 * Each call to invoke returns the next value in sequence. Useful when testing
 * evaluation of multiple AST nodes where the order of evaluation matters.
 *
 * @param values - Array of values to return sequentially
 * @returns A mock ThunkInvocationAdapter that returns values in order
 *
 * @example
 * // Returns 'first' on first call, 'second' on second call
 * const invoker = createSequentialMockInvoker(['first', 'second'])
 *
 * @example
 * // Testing array evaluation with dynamic values
 * const invoker = createSequentialMockInvoker(['Option 1', 'Option 2'])
 * const result = await handler.evaluate(context, invoker)
 * expect(result.value.options).toEqual(['Option 1', 'Option 2'])
 */
export function createSequentialMockInvoker(values: unknown[]): jest.Mocked<ThunkInvocationAdapter> {
  let callIndex = 0

  return createMockInvoker({
    invokeImpl: async () => {
      const value = values[callIndex]
      callIndex += 1

      return {
        value,
        metadata: {
          source: 'sequentialMockInvoker',
          timestamp: Date.now(),
        },
      }
    },
  })
}

/**
 * Create a mock ThunkInvocationAdapter that always returns an error result
 *
 * Useful for testing error handling paths in handlers.
 *
 * @param options - Customization options for the error
 * @returns A mock ThunkInvocationAdapter that returns an error
 *
 * @example
 * // Default error
 * const invoker = createMockInvokerWithError()
 *
 * @example
 * // Custom error message
 * const invoker = createMockInvokerWithError({ message: 'Data not found' })
 *
 * @example
 * // Custom error type and node
 * const invoker = createMockInvokerWithError({
 *   type: 'HANDLER_NOT_FOUND',
 *   nodeId: node.id,
 *   message: 'No handler registered',
 * })
 */
export function createMockInvokerWithError(
  options: {
    type?: ThunkErrorType
    nodeId?: NodeId
    message?: string
  } = {},
): jest.Mocked<ThunkInvocationAdapter> {
  const errorResult: ThunkResult = {
    error: {
      type: options.type ?? 'EVALUATION_FAILED',
      nodeId: options.nodeId ?? 'compile_ast:100',
      message: options.message ?? 'Evaluation failed',
    },
    metadata: { source: 'test', timestamp: Date.now() },
  }

  return createMockInvoker({
    invokeImpl: async (): Promise<ThunkResult> => errorResult,
    invokeSyncImpl: (): ThunkResult => errorResult,
  })
}

/**
 * Create mock runtime hooks for testing
 *
 * @returns A mock ThunkRuntimeHooks object with jest.fn() for all methods
 *
 * @example
 * const hooks = createMockHooks()
 * await handler.evaluate(context, invoker, hooks)
 * expect(hooks.registerRuntimeNodesBatch).toHaveBeenCalledWith([node], 'template')
 */
export function createMockHooks(): jest.Mocked<ThunkRuntimeHooks> {
  return {
    transformValue: jest.fn(),
    registerRuntimeNodesBatch: jest.fn(),
  }
}
