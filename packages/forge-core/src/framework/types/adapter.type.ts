import type ComponentRegistry from '../../components/ComponentRegistry'
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

/**
 * Dependencies provided by Forge when building an adapter.
 */
export interface FrameworkAdapterDependencies {
  componentRegistry: ComponentRegistry
  logger: Logger | Console
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
  registerRedirect(router: TRouter, fromPath: string, toPath: string): void
  forwardError(res: TResponse, error: unknown, next?: (error?: unknown) => void): void
  render(context: RenderContext, req: TRequest, res: TResponse): void
}
