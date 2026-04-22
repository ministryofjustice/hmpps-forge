import { JourneyInstanceDependencies, NodeId } from '../../types/engine.type'
import { ThunkHandler, ThunkInvocationAdapter, ThunkResult } from './types'
import type { StepRequest } from '../../../framework/types/request.type'
import type { StepResponse } from '../../../framework/types/response.type'
import ThunkHandlerRegistryError from '../../errors/ThunkHandlerRegistryError'
import ThunkEvaluationContext from './ThunkEvaluationContext'
import ThunkCacheManager from './ThunkCacheManager'
import { CompilationDependencies } from '../CompilationDependencies'

export default class ThunkEvaluator implements ThunkInvocationAdapter {
  private readonly cacheManager = new ThunkCacheManager()

  constructor(
    private readonly compilationDependencies: CompilationDependencies,
    private readonly journeyInstanceDependencies: JourneyInstanceDependencies,
  ) {}

  static withRuntimeOverlay(
    compilationDependencies: CompilationDependencies,
    journeyInstanceDependencies: JourneyInstanceDependencies,
  ): ThunkEvaluator {
    const { deps: runtimeDeps } = compilationDependencies.createOverlay()

    return new ThunkEvaluator(runtimeDeps, journeyInstanceDependencies)
  }

  async invoke<T = unknown>(nodeId: NodeId, context: ThunkEvaluationContext): Promise<ThunkResult<T>> {
    const cachedResult = this.cacheManager.get<T>(nodeId)

    if (cachedResult) {
      return cachedResult
    }

    const isolatedContext = context.withIsolatedScope()
    const handler = this.getHandler(nodeId)

    if (!handler.isAsync) {
      const result = handler.evaluateSync(isolatedContext, this) as ThunkResult<T>
      this.throwIfTypeMismatch(result)
      this.cacheManager.set(nodeId, result)

      return result
    }

    const result = (await handler.evaluate(isolatedContext, this)) as ThunkResult<T>
    this.throwIfTypeMismatch(result)
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

    const result = handler.evaluateSync(context, this) as ThunkResult<T>
    this.throwIfTypeMismatch(result)
    this.cacheManager.set(nodeId, result)

    return result
  }

  createContext(request: StepRequest, response: StepResponse): ThunkEvaluationContext {
    return new ThunkEvaluationContext(
      this.compilationDependencies,
      this.journeyInstanceDependencies,
      this.cacheManager,
      request,
      response,
    )
  }

  private getHandler(nodeId: NodeId): ThunkHandler {
    const handler = this.compilationDependencies.thunkHandlerRegistry.get(nodeId)

    if (!handler) {
      const registry = this.compilationDependencies.thunkHandlerRegistry
      throw ThunkHandlerRegistryError.notFound(nodeId, registry.size(), registry.getIds().slice(0, 10))
    }

    return handler
  }

  private throwIfTypeMismatch<T>(result: ThunkResult<T>): void {
    if (result.error?.type === 'TYPE_MISMATCH') {
      throw result.error.cause ?? new Error(result.error.message)
    }
  }
}
