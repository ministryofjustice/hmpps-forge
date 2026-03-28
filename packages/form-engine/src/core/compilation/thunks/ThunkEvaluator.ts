import { ASTNode, FormInstanceDependencies, NodeId } from '@form-engine/core/types/engine.type'
import {
  RuntimeOverlayBuilder,
  ThunkHandler,
  ThunkInvocationAdapter,
  ThunkResult,
} from '@form-engine/core/compilation/thunks/types'
import { StepRequest, StepResponse } from '@form-engine/core/runtime/routes/types'
import ThunkHandlerRegistryError from '@form-engine/errors/ThunkHandlerRegistryError'
import ThunkCompilerFactory from '@form-engine/core/compilation/thunks/ThunkCompilerFactory'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import ThunkCacheManager from '@form-engine/core/compilation/thunks/ThunkCacheManager'
import ThunkRuntimeHooksFactory from '@form-engine/core/compilation/thunks/ThunkRuntimeHooksFactory'
import { CompilationDependencies } from '@form-engine/core/compilation/CompilationDependencies'

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
  private readonly cacheManager = new ThunkCacheManager()

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
      nodeRegistry: runtimeDeps.nodeRegistry,
      nodeFactory: runtimeDeps.nodeFactory,
      runtimeNodes: new Map<NodeId, ASTNode>(),
    }

    return new ThunkEvaluator(runtimeDeps, formInstanceDependencies, overlay)
  }

  async invoke<T = unknown>(nodeId: NodeId, context: ThunkEvaluationContext): Promise<ThunkResult<T>> {
    const cachedResult = this.cacheManager.get<T>(nodeId)

    if (cachedResult) {
      return cachedResult
    }

    const isolatedContext = context.withIsolatedScope()
    const handler = this.getHandler(nodeId)

    if (!handler.isAsync) {
      const result = this.executeSyncHandler<T>(handler, isolatedContext)
      this.cacheManager.set(nodeId, result)

      return result
    }

    const hooks = this.runtimeHooksFactory.create(nodeId)
    const result = (await handler.evaluate(isolatedContext, this, hooks)) as ThunkResult<T>
    this.cacheManager.set(nodeId, result)

    return result
  }

  invokeSync<T = unknown>(nodeId: NodeId, context: ThunkEvaluationContext): ThunkResult<T> {
    const cachedResult = this.cacheManager.get<T>(nodeId)

    if (cachedResult) {
      return cachedResult
    }

    const handler = this.getHandler(nodeId)

    if (handler.isAsync) {
      throw new Error(
        `invokeSync() called on async handler: ${nodeId} (${handler.constructor.name}). ` +
          `Use invoke() instead or ensure handler.isAsync = false.`,
      )
    }

    const result = this.executeSyncHandler<T>(handler, context)
    this.cacheManager.set(nodeId, result)

    return result
  }

  private getHandler(nodeId: NodeId): ThunkHandler {
    const handler = this.compilationDependencies.thunkHandlerRegistry.get(nodeId)

    if (!handler) {
      const registry = this.compilationDependencies.thunkHandlerRegistry
      throw ThunkHandlerRegistryError.notFound(nodeId, registry.size(), registry.getIds().slice(0, 10))
    }

    return handler
  }

  private executeSyncHandler<T>(handler: ThunkHandler, context: ThunkEvaluationContext): ThunkResult<T> {
    const hooks = this.runtimeHooksFactory.create(handler.nodeId)

    return handler.evaluateSync(context, this, hooks) as ThunkResult<T>
  }

  /**
   * Create an evaluation context from request and response.
   *
   * Use this to create a context before running lifecycle transitions,
   * then pass the same context to evaluate().
   *
   * @param request - HTTP request data (url, post, query, params, etc.)
   * @param response - Response accumulator for headers and cookies
   * @returns A new ThunkEvaluationContext
   */
  createContext(request: StepRequest, response: StepResponse): ThunkEvaluationContext {
    return new ThunkEvaluationContext(
      this.compilationDependencies,
      this.formInstanceDependencies,
      this.cacheManager,
      request,
      response,
    )
  }
}
