import { NodeId, ASTNode } from '@form-engine/core/types/engine.type'
import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import DependencyGraph from '@form-engine/core/ast/dependencies/DependencyGraph'
import ThunkHandlerRegistry from '@form-engine/core/ast/thunks/registries/ThunkHandlerRegistry'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
import MetadataRegistry from '@form-engine/core/ast/registration/MetadataRegistry'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { PseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'

/**
 * Request data structure for evaluation
 */
export interface EvaluatorRequestData {
  post: Record<string, string | string[]>
  query: Record<string, string | string[]>
  params: Record<string, string>
  session?: Record<string, any>
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
 * Wraps the evaluated value with metadata for debugging and introspection
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
      metadata: ThunkResultMetadata
    }
  | {
      value?: never
      /**
       * Error that occurred during evaluation
       */
      error: ThunkError
      metadata: ThunkResultMetadata
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
 * Handler for evaluating a specific node in the AST
 *
 * Each node type (AST and pseudo) has a corresponding handler implementation
 * that knows how to evaluate that node to produce a concrete value.
 *
 * Handlers are async to support future async operations (API calls, etc.)
 */
export interface ThunkHandler {
  /**
   * The NodeId this handler is responsible for evaluating
   */
  nodeId: NodeId

  /**
   * Evaluate this node to produce a concrete value
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
 * Adapter for invoking other thunk handlers during evaluation
 *
 * Enables recursive evaluation with memoization:
 * - Checks memoization cache before invoking handler
 * - Stores results in cache for future use
 * - Prevents redundant computation
 */
export interface ThunkInvocationAdapter {
  /**
   * Invoke evaluation for a specific node
   *
   * This method handles:
   * 1. Cache lookup (return cached result if available)
   * 2. Handler lookup (find handler for nodeId)
   * 3. Handler execution (call handler.evaluate())
   * 4. Cache storage (store result for future invocations)
   *
   * @param nodeId - The node to evaluate
   * @param context - Runtime evaluation context
   * @returns Promise resolving to the evaluation result
   */
  invoke<T = unknown>(nodeId: NodeId, context: ThunkEvaluationContext): Promise<ThunkResult<T>>
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
 * Runtime overlay hooks - API provided to handlers for registering runtime nodes
 *
 * These hooks are passed to handler.evaluate() and allow handlers to:
 * 1. Create new AST nodes from JSON templates (with runtime IDs)
 * 2. Register newly created AST nodes (e.g., collection template instances)
 * 3. Create and register pseudo nodes for dynamic references
 *
 * The hooks automatically track metadata (which node created each runtime node)
 * to enable proper compilation pipeline processing between evaluation iterations.
 */
export interface RuntimeOverlayHooks {
  /**
   * Create a runtime AST node from JSON
   *
   * Uses NodeFactory configured with NodeIDCategory.RUNTIME_AST to automatically
   * generate runtime_ast:* IDs for the created nodes.
   *
   * @param json - The JSON definition to parse into an AST node
   * @returns The created AST node with runtime ID
   */
  createNode: (json: any) => ASTNode

  /**
   * Register a runtime node in the overlay
   *
   * Automatically tracks which node is currently being evaluated as the creator,
   * enabling metadata inheritance (isDescendantOfStep, isAncestorOfStep, attachedToParentNode, attachedToParentProperty).
   *
   * Also compiles and registers handlers for the node and its children.
   *
   * @param node - The runtime AST node to register (must have runtime_ast:* or runtime_pseudo:* ID)
   * @param property - The property name on the parent where this node is attached (e.g., 'template', 'fallback')
   */
  registerRuntimeNode: (node: ASTNode, property: string) => void

  /**
   * Create a runtime pseudo node for dynamic references
   *
   * Creates a pseudo node when one doesn't exist at compile time (e.g., dynamic references).
   * Does not register the node - use registerPseudoNode for that.
   *
   * @param type - The pseudo node type to create
   * @param properties - Properties for the pseudo node (e.g., baseFieldCode, paramName)
   * @returns The created pseudo node
   */
  createPseudoNode: (type: PseudoNodeType, properties: Record<string, unknown>) => PseudoNode

  /**
   * Register a runtime pseudo node
   *
   * Registers the pseudo node in the overlay registry, compiles its handler,
   * and registers the handler.
   *
   * @param pseudoNode - The pseudo node to register
   */
  registerPseudoNode: (pseudoNode: PseudoNode) => void
}

/**
 * Runtime hooks for extending evaluation (overlay builder, instrumentation, etc.)
 */
export type ThunkRuntimeHooks = RuntimeOverlayHooks

export type RuntimeOverlayConfigurator = (builder: RuntimeOverlayBuilder) => void

/**
 * Contains all information needed to execute the effect:
 * - effectName: Key in FunctionRegistry (e.g., 'saveAnswer', 'setData')
 * - args: Already evaluated argument values (resolved at capture time)
 * - nodeId: Original AST node for debugging/tracing
 */
export interface CapturedEffect {
  /**
   * Name of the effect function in FunctionRegistry
   * Examples: 'saveAnswer', 'setData', 'addToCollection'
   */
  effectName: string

  /**
   * Already evaluated argument values
   * These were resolved at capture time to preserve the state at that moment
   */
  args: unknown[]

  /**
   * Original AST node ID for debugging/tracing
   */
  nodeId: NodeId
}
