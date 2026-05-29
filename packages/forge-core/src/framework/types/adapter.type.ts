import type { ComponentRegistryEntry } from '../../components/types/components.type'
import type { BlockDefinition } from '../../components/types/structures.type'
import type { ForgeResult } from '../../engine/runtime/orchestrator/types'
import type { ForgeInstrumentation } from '../../instrumentation/ForgeInstrumentation'
import type { RenderContext } from '../rendering/types'
import type { StepRequest } from './request.type'
import type { StepResponse } from './response.type'

/**
 * A minimal logger interface compatible with pino, bunyan, console, and most logging libraries.
 */
export interface Logger {
  info(...args: unknown[]): void
  error(...args: unknown[]): void
  warn(...args: unknown[]): void
  debug(...args: unknown[]): void
}

export interface ComponentRegistry {
  get<T extends BlockDefinition>(variant: string): ComponentRegistryEntry<T> | undefined
  getAll(): ReadonlyMap<string, ComponentRegistryEntry<BlockDefinition>>
}

/**
 * Dependencies provided by Forge when building an adapter.
 */
export interface FrameworkAdapterDependencies {
  logger: Logger | Console
  instrumentation: ForgeInstrumentation
}

/**
 * Framework-agnostic step handler function.
 */
export type StepHandler<TRequest, TResponse> = (req: TRequest, res: TResponse) => Promise<void>

/**
 * Builder for creating framework adapters.
 */
export interface FrameworkAdapterBuilder<TRouter, TRequest, TResponse> {
  build(deps: FrameworkAdapterDependencies): FrameworkAdapter<TRouter, TRequest, TResponse>
}

/**
 * Adapter for web framework integration.
 */
export interface FrameworkAdapter<TRouter, TRequest, TResponse> {
  createRouter(): TRouter
  mountRouter(parent: TRouter, path: string, child: TRouter): void
  get(router: TRouter, path: string, handler: StepHandler<TRequest, TResponse>): void
  post(router: TRouter, path: string, handler: StepHandler<TRequest, TResponse>): void
  toStepRequest(req: TRequest): StepRequest
  toStepResponse(res: TResponse): StepResponse
  redirect(res: TResponse, url: string): void
  forwardError(res: TResponse, error: unknown, next?: (error?: unknown) => void): void
  render(context: RenderContext, req: TRequest, res: TResponse, componentRegistry: ComponentRegistry): void
  applyResult(result: ForgeResult, req: TRequest, res: TResponse, componentRegistry: ComponentRegistry): void
}
