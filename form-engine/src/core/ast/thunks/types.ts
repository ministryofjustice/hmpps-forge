import { NodeId, ASTNode } from '@form-engine/core/types/engine.type'
import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import DependencyGraph from '@form-engine/core/ast/dependencies/DependencyGraph'
import ThunkHandlerRegistry from '@form-engine/core/ast/thunks/registries/ThunkHandlerRegistry'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
import MetadataRegistry from '@form-engine/core/ast/registration/MetadataRegistry'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'
import type { RuntimeOverlayHooks } from '@form-engine/core/ast/thunks/factories/ThunkRuntimeHooksFactory'

/**
 * Transition types that can set answers
 *
 * Used to track where an answer value originated from:
 * - load: Set during onLoad transitions (e.g., loading from API)
 * - access: Set during onAccess transitions
 * - action: Set during onAction transitions (e.g., postcode lookup)
 * - submit: Set during onSubmission transitions
 */
export type TransitionType = 'load' | 'access' | 'action' | 'submit'

/**
 * Sources that can provide answer values
 *
 * Extends TransitionType with non-transition sources:
 * - post: Raw value from POST form data
 * - sanitized: Value after HTML entity sanitization
 * - processed: Value after running through formatter pipeline
 * - default: Value from field's defaultValue
 * - dependent: Value cleared because field's dependent condition was false
 */
export type AnswerSource = TransitionType | 'post' | 'sanitized' | 'processed' | 'default' | 'dependent'

/**
 * A single mutation to an answer value
 *
 * Records the value and which lifecycle phase set it.
 */
export interface AnswerMutation {
  value: unknown
  source: AnswerSource
}

/**
 * History of mutations to an answer over the request lifecycle
 *
 * Tracks how an answer evolved through different phases:
 * - load: API/session data loaded during onLoad
 * - action: In-page actions like postcode lookup
 * - post: Raw POST form data
 * - processed: POST data after formatter pipeline
 * - default: Field's defaultValue
 *
 * Enables:
 * - Precedence logic (action-set answers protected from POST override)
 * - Delta queries (what changed during submission)
 * - Debugging (how did this answer reach its current value)
 */
export interface AnswerHistory {
  current: unknown
  mutations: AnswerMutation[]
}

/**
 * HTTP method for the request
 */
export type HttpMethod = 'GET' | 'POST'

/**
 * Request data structure for evaluation
 */
export interface EvaluatorRequestData {
  method: HttpMethod
  post: Record<string, string | string[]>
  query: Record<string, string | string[]>
  params: Record<string, string>
  session?: any
  state?: Record<string, any>
}

/**
 * Metadata about a thunk evaluation
 */
export interface ThunkResultMetadata {
  /**
   * Where the value came from
   * Examples: 'post', 'defaultValue', 'formatPipeline', 'query'
   * Critical for Answer pseudo node resolution strategy
   */
  source?: string

  /**
   * When the evaluation occurred (milliseconds since epoch)
   */
  timestamp?: number

  /**
   * NodeIds that this evaluation depended on
   * Used for validation and dependency tracking
   */
  dependencies?: NodeId[]

  /**
   * Whether this result came from memoization cache
   */
  cached?: boolean
}

/**
 * Result of evaluating a thunk handler
 * Wraps the evaluated value with optional metadata for debugging and introspection
 *
 * This is a discriminated union that enforces "either value OR error, not both"
 */
export type ThunkResult<T = unknown> =
  | {
      /**
       * The successfully evaluated value
       */
      value: T
      error?: never
      metadata?: ThunkResultMetadata
    }
  | {
      value?: never
      /**
       * Error that occurred during evaluation
       */
      error: ThunkError
      metadata?: ThunkResultMetadata
    }

/**
 * What handlers return - metadata is optional
 *
 * Infrastructure (ThunkEvaluator) automatically adds source and timestamp.
 * Handlers can optionally provide additional metadata fields which get appended,
 * or override source/timestamp if needed.
 */
export type HandlerResult<T = unknown> =
  | { value: T; error?: never; metadata?: Partial<ThunkResultMetadata> }
  | { value?: never; error: ThunkError; metadata?: Partial<ThunkResultMetadata> }

/**
 * Error categories for thunk evaluation failures
 */
export type ThunkErrorType =
  | 'HANDLER_REGISTRY'
  | 'LOOKUP_FAILED'
  | 'TYPE_MISMATCH'
  | 'EVALUATION_FAILED'
  | 'SECURITY'
  | 'UNKNOWN'

/**
 * Structured error information for thunk evaluation failures
 * Provides detailed context for debugging and error reporting
 */
export interface ThunkError {
  /**
   * Category of error
   */
  type: ThunkErrorType

  /**
   * NodeId where the error occurred
   * Used for error tracing and debugging
   */
  nodeId: NodeId

  /**
   * Human-readable error message
   */
  message: string

  /**
   * Original error that caused this failure
   * Enables error chaining for nested failures
   */
  cause?: Error

  /**
   * Additional context for debugging
   * May contain node details, evaluation state, etc.
   */
  context?: Record<string, unknown>
}

/**
 * Synchronous thunk handler for pure operations
 */
export interface SyncThunkHandler {
  /**
   * The NodeId this handler is responsible for evaluating
   */
  readonly nodeId: NodeId

  /**
   * Metadata flag indicating this handler is synchronous
   * Always false for SyncThunkHandler
   */
  readonly isAsync: false

  /**
   * Evaluate synchronously and return result directly
   * No Promise overhead - returns in microseconds
   *
   * Returns HandlerResult with optional metadata. Handler-provided
   * metadata fields are appended and can override defaults if needed.
   *
   * @param context - Runtime evaluation context with data and services
   * @param invoker - Adapter for recursively evaluating other nodes
   * @returns The evaluation result (no Promise)
   */
  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult<unknown>
}

/**
 * Asynchronous thunk handler for operations requiring async
 *
 * Use for handlers that:
 * - Call external services
 * - Await other async operations
 * - Have genuine async requirements
 *
 * Examples: AnswerLocalHandler, EffectHandler, CollectionHandler
 */
export interface AsyncThunkHandler {
  /**
   * The NodeId this handler is responsible for evaluating
   */
  readonly nodeId: NodeId

  /**
   * Metadata flag indicating this handler is asynchronous
   * Always true for AsyncThunkHandler
   */
  readonly isAsync: true

  /**
   * Evaluate asynchronously and return Promise
   *
   * Returns HandlerResult with optional metadata. Infrastructure automatically
   * adds source (from handler class name) and timestamp. Handler-provided
   * metadata fields are appended and can override defaults if needed.
   *
   * @param context - Runtime evaluation context with data and services
   * @param invoker - Adapter for recursively evaluating other nodes
   * @param hooks - Runtime hooks for logging, metrics, etc.
   * @returns Promise resolving to the evaluation result
   */
  evaluate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    hooks: ThunkRuntimeHooks,
  ): Promise<HandlerResult<unknown>>
}

/**
 * Dependencies needed to compute isAsync metadata for handlers
 *
 * Passed to HybridThunkHandler.computeIsAsync() during the second compilation pass
 * to allow handlers to determine if they need async evaluation based on their dependencies.
 */
export interface MetadataComputationDependencies {
  /**
   * Registry of all compiled thunk handlers
   * Used to check if child/referenced handlers are async
   */
  thunkHandlerRegistry: ThunkHandlerRegistry

  /**
   * Registry of all user-defined functions (conditions, transformers, effects)
   * Used to check if functions are async
   */
  functionRegistry: FunctionRegistry

  /**
   * Registry of all AST nodes and pseudo nodes
   * Used to access node properties during metadata computation
   */
  nodeRegistry: NodeRegistry

  /**
   * Registry of node metadata (isDescendantOfStep, isCurrentStep, etc.)
   * Used to determine step context during metadata computation
   */
  metadataRegistry: MetadataRegistry
}

/**
 * Hybrid thunk handler that implements both sync and async evaluation
 *
 * Use for handlers that:
 * - Can be sync OR async depending on their dependencies
 * - Want to optimize for the sync case when possible
 * - Need to propagate async metadata from children
 *
 * The isAsync property is computed during the second compilation pass by calling
 * computeIsAsync(). Based on this flag, the evaluator routes to either the sync
 * or async evaluation path.
 *
 * Examples: ConditionalHandler, BlockHandler, StepHandler, FunctionHandler, TestPredicateHandler
 */
export interface HybridThunkHandler {
  /**
   * The NodeId this handler is responsible for evaluating
   */
  readonly nodeId: NodeId

  /**
   * Whether this handler requires async evaluation
   *
   * Computed during second compilation pass by calling computeIsAsync().
   * Defaults to true (safe fallback) until computed.
   */
  isAsync: boolean

  /**
   * Compute whether this handler requires async evaluation
   *
   * Called during second compilation pass after all handlers have been created.
   * Handler should check its dependencies (child handlers, functions) and set
   * this.isAsync based on whether any of them are async.
   *
   * @param deps - Dependencies needed for metadata computation
   */
  computeIsAsync(deps: MetadataComputationDependencies): void

  /**
   * Evaluate synchronously and return result directly
   *
   * Only called when isAsync is false. Must not use await or return Promises.
   * No Promise overhead - returns in microseconds.
   *
   * @param context - Runtime evaluation context with data and services
   * @param invoker - Adapter for recursively evaluating other nodes
   * @returns The evaluation result (no Promise)
   */
  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult<unknown>

  /**
   * Evaluate asynchronously and return Promise
   *
   * Only called when isAsync is true. Can use await and async operations.
   *
   * @param context - Runtime evaluation context with data and services
   * @param invoker - Adapter for recursively evaluating other nodes
   * @param hooks - Runtime hooks for logging, metrics, etc.
   * @returns Promise resolving to the evaluation result
   */
  evaluate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    hooks: ThunkRuntimeHooks,
  ): Promise<HandlerResult<unknown>>
}

/**
 * Handler for evaluating a specific node in the AST
 *
 * Union type - handler can be sync, async, or hybrid.
 * This allows the evaluator to detect sync handlers and fast-path them
 * (no Promise overhead) while maintaining support for async handlers.
 *
 * Each node type (AST and pseudo) has a corresponding handler implementation
 * that knows how to evaluate that node to produce a concrete value.
 */
export type ThunkHandler = SyncThunkHandler | AsyncThunkHandler | HybridThunkHandler

/**
 * Adapter for invoking other thunk handlers during evaluation
 *
 * Enables recursive evaluation with memoization:
 * - Checks memoization cache before invoking handler
 * - Stores results in cache for future use
 * - Prevents redundant computation
 *
 * Supports both async and sync invocation:
 * - invoke() for async or unknown handler types
 * - invokeSync() for known sync handlers (faster, no Promise overhead)
 */
export interface ThunkInvocationAdapter {
  /**
   * Invoke a handler asynchronously (always returns Promise)
   *
   * Use when:
   * - You don't know if the handler is sync or async
   * - You need to await the result
   * - You're in an async context
   *
   * This method handles:
   * 1. Cache lookup (return cached result if available)
   * 2. Handler lookup (find handler for nodeId)
   * 3. Handler execution (call handler.evaluate() or handler.evaluateSync())
   * 4. Cache storage (store result for future invocations)
   *
   * Note: If handler is sync, it will be auto-detected and fast-pathed
   * (executed synchronously, then wrapped in a resolved Promise).
   *
   * @param nodeId - The node to evaluate
   * @param context - Runtime evaluation context
   * @returns Promise resolving to the evaluation result
   */
  invoke<T = unknown>(nodeId: NodeId, context: ThunkEvaluationContext): Promise<ThunkResult<T>>

  /**
   * Invoke a handler synchronously (direct return)
   *
   * Use when:
   * - You KNOW the handler is sync (e.g., pseudo nodes)
   * - You want to avoid Promise overhead
   * - You're in a performance-critical path
   *
   * This method handles:
   * 1. Cache lookup (return cached result if available)
   * 2. Handler lookup (find handler for nodeId)
   * 3. Verify handler is sync (throws if not)
   * 4. Handler execution (call handler.evaluateSync())
   * 5. Cache storage (store result for future invocations)
   *
   * @param nodeId - The node to evaluate
   * @param context - Runtime evaluation context
   * @returns The evaluation result (no Promise)
   * @throws Error if handler is not synchronous
   */
  invokeSync<T = unknown>(nodeId: NodeId, context: ThunkEvaluationContext): ThunkResult<T>
}

/**
 * Runtime overlay builder - manages dynamically created nodes during evaluation
 *
 * Created via ThunkEvaluator.withRuntimeOverlay(), this builder contains cloned
 * registries and graphs that accumulate runtime nodes without mutating the
 * original compile-time structures.
 *
 * Used by handlers (e.g., CollectionHandler) to register nodes created during
 * evaluation, enabling dynamic form structures based on runtime data.
 */
export interface RuntimeOverlayBuilder {
  /** Cloned node registry - accumulates both compile-time and runtime nodes */
  nodeRegistry: NodeRegistry

  /** Cloned handler registry - accumulates handlers for compile-time and runtime nodes */
  handlerRegistry: ThunkHandlerRegistry

  /** Cloned metadata registry - accumulates metadata for compile-time and runtime nodes */
  metadataRegistry: MetadataRegistry

  /** Cloned dependency graph - accumulates edges for compile-time and runtime nodes */
  dependencyGraph: DependencyGraph

  /** Fresh node factory using cloned dependencies */
  nodeFactory: NodeFactory

  /** Map of all runtime nodes created during evaluation (runtime_ast:* and runtime_pseudo:*) */
  runtimeNodes: Map<NodeId, ASTNode>
}

/**
 * Runtime hooks for extending evaluation (overlay builder, instrumentation, etc.)
 * Derived from ThunkRuntimeHooksFactory.create()
 */
export type ThunkRuntimeHooks = RuntimeOverlayHooks

export type RuntimeOverlayConfigurator = (builder: RuntimeOverlayBuilder) => void
