import { NodeId, FormInstanceDependencies, ASTNode } from '@form-engine/core/types/engine.type'
import {
  ThunkHandler,
  ThunkInvocationAdapter,
  ThunkResult,
  RuntimeOverlayBuilder,
  ThunkRuntimeHooks,
} from '@form-engine/core/compilation/thunks/types'
import { StepRequest } from '@form-engine/core/runtime/routes/types'
import ThunkHandlerRegistryError from '@form-engine/errors/ThunkHandlerRegistryError'
import ThunkEvaluationError from '@form-engine/errors/ThunkEvaluationError'
import ThunkCompilerFactory from '@form-engine/core/compilation/thunks/ThunkCompilerFactory'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import ThunkCacheManager from '@form-engine/core/compilation/thunks/ThunkCacheManager'
import ThunkRuntimeHooksFactory from '@form-engine/core/compilation/thunks/ThunkRuntimeHooksFactory'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { CompilationDependencies } from '@form-engine/core/compilation/CompilationDependencies'

/**
 * Result of evaluating a form
 */
export interface EvaluationResult {
  context: ThunkEvaluationContext
  journey: ThunkResult<unknown>
}

/**
 * Runtime evaluator that orchestrates lazy thunk handler execution.
 *
 * ThunkEvaluator implements the ThunkInvocationAdapter interface, providing
 * memoized handler invocation for recursive evaluation. It coordinates the
 * evaluation process by:
 *
 * 1. Building evaluation context from request data
 * 2. Invoking the Journey node (root of AST)
 * 3. Handlers recursively invoke their dependencies via invoke()
 * 4. Managing memoization cache to prevent redundant computation
 * 5. Collecting and returning evaluation results
 *
 * Lazy evaluation means nodes are only evaluated when explicitly invoked by
 * their parents, enabling natural control flow and conditional evaluation.
 *
 * The evaluator is stateless - each evaluation creates a fresh cache and
 * context, ensuring no state leaks across requests.
 *
 * Use the static `withRuntimeOverlay()` factory to create instances - the
 * constructor is private to enforce that evaluation always has a runtime overlay.
 */
export default class ThunkEvaluator implements ThunkInvocationAdapter {
  /**
   * Cache manager for memoization and dirty tracking
   */
  private readonly cacheManager = new ThunkCacheManager()

  /**
   * In-flight evaluation promises to prevent parallel duplicate evaluations.
   * When multiple callers invoke the same node simultaneously, they await the same Promise.
   */
  private readonly inFlightEvaluations = new Map<NodeId, Promise<ThunkResult>>()

  /**
   * Factory for creating runtime hooks
   */
  private readonly runtimeHooksFactory: ThunkRuntimeHooksFactory

  /**
   * Construct a ThunkEvaluator
   *
   * **Prefer using `ThunkEvaluator.withRuntimeOverlay()` instead.**
   * This static factory handles cloning compilation dependencies and
   * setting up the runtime overlay correctly.
   *
   * Direct construction is primarily for unit testing with mocked dependencies.
   */
  constructor(
    private readonly compilationDependencies: CompilationDependencies,
    private readonly formInstanceDependencies: FormInstanceDependencies,
    runtimeOverlayBuilder: RuntimeOverlayBuilder,
  ) {
    this.runtimeHooksFactory = new ThunkRuntimeHooksFactory(
      compilationDependencies,
      new ThunkCompilerFactory(),
      this.cacheManager,
      runtimeOverlayBuilder,
      formInstanceDependencies.functionRegistry,
    )
  }

  /**
   * Create an evaluator with a runtime overlay.
   *
   * This factory creates O(1) overlay wrappers around the compilation dependencies,
   * allowing runtime-expanded nodes/edges/handlers to be registered without
   * mutating the original compiled program or copying data.
   *
   * @param compilationDependencies - The compiled form dependencies
   * @param formInstanceDependencies - Form instance runtime dependencies
   * @returns A new ThunkEvaluator ready for evaluation
   */
  static withRuntimeOverlay(
    compilationDependencies: CompilationDependencies,
    formInstanceDependencies: FormInstanceDependencies,
  ): ThunkEvaluator {
    const { deps: runtimeDeps } = compilationDependencies.createOverlay()

    const overlay: RuntimeOverlayBuilder = {
      handlerRegistry: runtimeDeps.thunkHandlerRegistry,
      metadataRegistry: runtimeDeps.metadataRegistry,
      dependencyGraph: runtimeDeps.dependencyGraph,
      nodeRegistry: runtimeDeps.nodeRegistry,
      nodeFactory: runtimeDeps.nodeFactory,
      runtimeNodes: new Map<NodeId, ASTNode>(),
    }

    return new ThunkEvaluator(runtimeDeps, formInstanceDependencies, overlay)
  }

  /**
   * Invoke evaluation for a specific node (ThunkInvocationAdapter implementation)
   *
   * This method implements the memoization strategy with retry logic:
   * 1. Check cache for existing result
   * 2. Look up handler from registry
   * 3. Capture version counter at start
   * 4. Execute handler (which may recursively call invoke)
   * 5. Check if node was invalidated during execution (version changed)
   * 6. If invalidated, retry evaluation (up to maxRetries)
   * 7. Store result in cache and return
   *
   * @param nodeId - The node to evaluate
   * @param context - Runtime evaluation context
   * @returns Promise resolving to the evaluation result
   */
  async invoke<T = unknown>(nodeId: NodeId, context: ThunkEvaluationContext): Promise<ThunkResult<T>> {
    // Check cache result before creating isolated context waste
    const cachedResult = this.cacheManager.getWithCachedFlag<T>(nodeId)

    if (cachedResult) {
      return cachedResult
    }

    // Create isolated scope for this invocation to prevent scope pollution
    // when multiple evaluations run in parallel (e.g., Promise.all in BlockHandler)
    const isolatedContext = context.withIsolatedScope()

    return this.invokeWithRetry(nodeId, isolatedContext, 10)
  }

  /**
   * Invoke a handler synchronously (ThunkInvocationAdapter implementation)
   *
   * This is the fast path for handlers known to be synchronous - no Promise
   * overhead, no microtask queue. Throws if handler is not synchronous.
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
  invokeSync<T = unknown>(nodeId: NodeId, context: ThunkEvaluationContext): ThunkResult<T> {
    // Fast path: Check cache
    const cachedResult = this.cacheManager.getWithCachedFlag<T>(nodeId)

    if (cachedResult) {
      return cachedResult
    }

    // Lookup handler
    const handler = this.compilationDependencies.thunkHandlerRegistry.get(nodeId)

    if (!handler) {
      const registry = this.compilationDependencies.thunkHandlerRegistry
      throw ThunkHandlerRegistryError.notFound(nodeId, registry.size(), registry.getIds().slice(0, 10))
    }

    // Verify handler is actually sync
    if (handler.isAsync) {
      throw new Error(
        `invokeSync() called on async handler: ${nodeId} (${handler.constructor.name}). ` +
          `Use invoke() instead or ensure handler.isAsync = false.`,
      )
    }

    // Execute synchronously - NO Promise overhead!
    const result = this.executeSyncHandler<T>(handler, context)
    this.cacheManager.set(nodeId, result)

    return result
  }

  /**
   * Internal invoke implementation with retry logic
   *
   * Separated from public invoke() to keep maxRetries as implementation detail
   *
   * @param nodeId - The node to evaluate
   * @param context - Runtime evaluation context
   * @param maxRetries - Maximum number of retries if invalidated during evaluation
   * @returns Promise resolving to the evaluation result
   */
  private async invokeWithRetry<T = unknown>(
    nodeId: NodeId,
    context: ThunkEvaluationContext,
    maxRetries: number,
  ): Promise<ThunkResult<T>> {
    // Look up handler from registry
    const handler = this.compilationDependencies.thunkHandlerRegistry.get(nodeId)

    if (!handler) {
      const registry = this.compilationDependencies.thunkHandlerRegistry
      throw ThunkHandlerRegistryError.notFound(nodeId, registry.size(), registry.getIds().slice(0, 10))
    }

    // Branch based on handler type
    if (!handler.isAsync) {
      // SYNC PATH: Execute immediately, no async overhead
      const result = this.executeSyncHandler<T>(handler, context)

      // Cache result
      this.cacheManager.set(nodeId, result)

      return result
    }

    // ASYNC PATH: Dedupe concurrent evaluations and execute
    const { result } = await this.withInFlightTracking(nodeId, () =>
      this.evaluateWithRetry<T>(nodeId, handler, context, maxRetries),
    )

    return result
  }

  /**
   * Track an in-flight evaluation to prevent parallel duplicate evaluations.
   *
   * When multiple callers invoke the same node simultaneously, they all await
   * the same Promise rather than each starting their own evaluation.
   *
   * @param nodeId - The node being evaluated
   * @param compute - Function that performs the actual evaluation
   * @returns Promise resolving to the evaluation result with deduped flag
   */
  private async withInFlightTracking<T>(
    nodeId: NodeId,
    compute: () => Promise<ThunkResult<T>>,
  ): Promise<{ result: ThunkResult<T>; wasDeduplicated: boolean }> {
    const existing = this.inFlightEvaluations.get(nodeId)

    if (existing) {
      const result = (await existing) as ThunkResult<T>
      return { result, wasDeduplicated: true }
    }

    const promise = compute()

    this.inFlightEvaluations.set(nodeId, promise as Promise<ThunkResult>)

    try {
      const result = await promise
      return { result, wasDeduplicated: false }
    } finally {
      this.inFlightEvaluations.delete(nodeId)
    }
  }

  /**
   * Execute evaluation with retry logic for mid-evaluation invalidations
   */
  private async evaluateWithRetry<T>(
    nodeId: NodeId,
    handler: ThunkHandler,
    context: ThunkEvaluationContext,
    maxRetries: number,
  ): Promise<ThunkResult<T>> {
    let retries = 0
    let result: ThunkResult<T> | undefined

    while (retries < maxRetries) {
      // Capture version at START of evaluation
      const versionAtStart = this.cacheManager.getVersion(nodeId)

      // Create contextual hooks for this evaluation attempt
      const contextualHooks = this.runtimeHooksFactory.create(nodeId)

      // eslint-disable-next-line no-await-in-loop
      result = await this.executeHandler<T>(handler, context, contextualHooks)

      // Check version at END of evaluation
      const versionAtEnd = this.cacheManager.getVersion(nodeId)

      if (versionAtEnd === versionAtStart) {
        // No invalidation during evaluation - result is valid
        this.cacheManager.set(nodeId, result)

        return result
      }

      // Node was invalidated during evaluation - result is stale
      // Clear cache and retry
      this.cacheManager.delete(nodeId)
      retries += 1
    }

    // Exceeded max retries - likely infinite invalidation loop
    throw ThunkEvaluationError.maxRetriesExceeded(nodeId, retries, maxRetries)
  }

  /**
   * Execute handler
   *
   * @param handler - The handler to execute
   * @param context - Runtime evaluation context
   * @param hooks - Runtime hooks
   * @returns Promise resolving to evaluation result
   */
  private async executeHandler<T>(
    handler: ThunkHandler,
    context: ThunkEvaluationContext,
    hooks: ThunkRuntimeHooks,
  ): Promise<ThunkResult<T>> {
    // TypeScript doesn't know that handler must have isAsync=true here
    // (because sync handlers were already handled in invokeWithRetry)
    // So we handle the sync case gracefully just in case
    if (!handler.isAsync) {
      return handler.evaluateSync(context, this) as ThunkResult<T>
    }

    return (await handler.evaluate(context, this, hooks)) as ThunkResult<T>
  }

  /**
   * Execute sync handler - errors bubble up to Express error handler
   *
   * Direct synchronous execution - no Promise overhead, no async machinery.
   *
   * @param handler - The sync handler to execute
   * @param context - Runtime evaluation context
   * @returns Evaluation result
   */
  private executeSyncHandler<T>(handler: ThunkHandler, context: ThunkEvaluationContext): ThunkResult<T> {
    return handler.evaluateSync(context, this) as ThunkResult<T>
  }

  /**
   * Create an evaluation context from request data.
   *
   * Use this to create a context before running lifecycle transitions,
   * then pass the same context to evaluate().
   *
   * @param request - HTTP request data (post, query, params)
   * @returns A new ThunkEvaluationContext
   */
  createContext(request: StepRequest): ThunkEvaluationContext {
    return new ThunkEvaluationContext(
      this.compilationDependencies,
      this.formInstanceDependencies,
      this.cacheManager,
      request,
    )
  }

  /**
   * Main entry point: evaluate form starting from Journey node
   *
   * Orchestrates lazy evaluation by:
   * 1. Invoke the Journey node (root of AST)
   * 2. Return context with all evaluated values
   *
   * The Journey node invokes its children (Steps), which invoke their children (Blocks),
   * and so on, creating a natural lazy evaluation cascade. Memoization prevents redundant
   * computation when nodes are referenced multiple times.
   *
   * Version counters detect mid-evaluation invalidations (e.g., Collections adding
   * runtime nodes) and trigger retries to ensure correct results.
   *
   * Note: Lifecycle transitions (onLoad, onAccess, onSubmit) should be executed
   * before calling evaluate(), using LifecycleCoordinator.handleRequest().
   *
   * @param context - Evaluation context created via createContext()
   * @returns Promise resolving to evaluation result with context and journey
   */
  async evaluate(context: ThunkEvaluationContext): Promise<EvaluationResult> {
    // Find and invoke the Journey node (root of the AST)
    // The Journey handler will recursively invoke all necessary nodes
    const journeyNodes = this.compilationDependencies.nodeRegistry.findByType(ASTNodeType.JOURNEY)

    let journey: ThunkResult<unknown> = {
      value: undefined,
      metadata: { source: 'ThunkEvaluator.evaluate', timestamp: Date.now() },
    }

    if (journeyNodes.length > 0) {
      journey = await this.invoke(journeyNodes[0].id, context)
    }

    return { context, journey }
  }
}
