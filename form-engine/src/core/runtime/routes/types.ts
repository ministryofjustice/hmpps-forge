import type Logger from 'bunyan'
import { HttpMethod } from '@form-engine/core/compilation/thunks/types'
import { RenderContext } from '@form-engine/core/runtime/rendering/types'
import ComponentRegistry from '@form-engine/registry/ComponentRegistry'
import { NodeId } from '@form-engine/core/types/engine.type'
import { CompilationArtefact, CompiledStep } from '@form-engine/core/compilation/FormCompilationFactory'
import { StepASTNode } from '@form-engine/core/types/structures.type'

export type StepResolver = () => Promise<CompiledStep>

export interface RouteMapEntry {
  stepId: NodeId
  resolveCompiledStep: StepResolver
}

export interface StepMountContext {
  stepId: NodeId
  stepNode: StepASTNode
  sharedArtefact: CompilationArtefact
  resolveCompiledStep: StepResolver
}

/**
 * Options for setting a cookie
 */
export interface CookieOptions {
  maxAge?: number
  expires?: Date
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  path?: string
  domain?: string
}

/**
 * A cookie value with its options
 */
export interface CookieMutation {
  value: string
  options?: CookieOptions
}

/**
 * Framework-agnostic response interface
 *
 * Provides methods for setting headers and cookies on the response.
 * The framework adapter implements these methods to write directly to the native response.
 *
 * To clear a cookie, use setCookie with maxAge: 0
 */
export interface StepResponse {
  setHeader(name: string, value: string): void
  getHeader(name: string): string | undefined
  getAllHeaders(): Map<string, string>
  setCookie(name: string, value: string, options?: CookieOptions): void
  getCookie(name: string): CookieMutation | undefined
  getAllCookies(): Map<string, CookieMutation>
}

/**
 * Dependencies provided by FormEngine when building an adapter
 */
export interface FrameworkAdapterDependencies {
  componentRegistry: ComponentRegistry
  logger: Logger | Console
}

/**
 * Builder for creating framework adapters
 *
 * This pattern allows users to configure adapter-specific options (e.g., nunjucksEnv)
 * while letting FormEngine provide its internal dependencies (componentRegistry).
 *
 * @example
 * ```typescript
 * // User configures the adapter with their options
 * frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv })
 *
 * // FormEngine internally calls .build() with its dependencies
 * const adapter = builder.build({ componentRegistry })
 * ```
 */
export interface FrameworkAdapterBuilder<TRouter, TRequest, TResponse> {
  build(deps: FrameworkAdapterDependencies): FrameworkAdapter<TRouter, TRequest, TResponse>
}

/**
 * Framework-agnostic request interface
 *
 * Provides methods for reading request data. The framework adapter implements
 * these methods to read from the native request object.
 */
export interface StepRequest {
  readonly method: HttpMethod
  readonly url: string

  getHeader(name: string): string | string[] | undefined
  getAllHeaders(): Record<string, string | string[] | undefined>
  getCookie(name: string): string | undefined
  getAllCookies(): Record<string, string | undefined>
  getParam(name: string): string | undefined
  getParams(): Record<string, string>
  getQuery(name: string): string | string[] | undefined
  getAllQuery(): Record<string, string | string[]>
  getPost(name: string): string | string[] | undefined
  getAllPost(): Record<string, string | string[]>
  getSession(): unknown
  getState(key: string): unknown
  getAllState(): Record<string, unknown>
}

/**
 * Controller interface for handling step requests
 *
 * Controllers are responsible for processing requests and sending responses
 * directly via the framework adapter. They handle:
 * - Request/response conversion via the framework adapter
 * - Request evaluation and validation
 * - Lifecycle hooks (access, submission)
 * - Response rendering or redirecting
 *
 * @typeParam TRequest - Framework-specific request type
 * @typeParam TResponse - Framework-specific response type
 */
export interface StepController<TRequest, TResponse> {
  get(req: TRequest, res: TResponse): Promise<void>
  post(req: TRequest, res: TResponse): Promise<void>
}

/**
 * Framework-agnostic step handler function
 *
 * Called by the framework adapter to handle a route.
 * The adapter handles error wrapping and framework-specific details.
 */
export type StepHandler<TRequest, TResponse> = (req: TRequest, res: TResponse) => Promise<void>

/**
 * Adapter for web framework integration
 *
 * **Single Adapter Pattern:** This interface handles BOTH routing AND rendering.
 * There is no separate RenderingAdapter - all framework integration goes through
 * this single adapter. This keeps integration concerns together since web frameworks
 * and template engines are typically used together (e.g., Express + Nunjucks).
 *
 * Handles:
 * - Router creation and mounting
 * - Route registration (GET/POST handlers)
 * - Request/response conversion
 * - Page template rendering via `render()` method
 *
 * **Implementation example:** See `ExpressFrameworkAdapter` in `@form-engine-express-nunjucks`
 *
 * @typeParam TRouter - Framework-specific router type (e.g., express.Router)
 * @typeParam TRequest - Framework-specific request type (e.g., express.Request)
 * @typeParam TResponse - Framework-specific response type (e.g., express.Response)
 */
export interface FrameworkAdapter<TRouter, TRequest, TResponse> {
  /**
   * Create a new router instance
   */
  createRouter(): TRouter

  /**
   * Mount a child router at a path on a parent router
   *
   * @param parent - Parent router to mount on
   * @param path - Path prefix for the child router
   * @param child - Child router to mount
   */
  mountRouter(parent: TRouter, path: string, child: TRouter): void

  /**
   * Register a GET route handler
   *
   * The adapter wraps the handler with error handling and forwards
   * errors to the framework's error handler.
   *
   * @param router - Router to register the route on
   * @param path - Route path
   * @param handler - Handler function to invoke when route is matched
   */
  get(router: TRouter, path: string, handler: StepHandler<TRequest, TResponse>): void

  /**
   * Register a POST route handler
   *
   * The adapter wraps the handler with error handling and forwards
   * errors to the framework's error handler.
   *
   * @param router - Router to register the route on
   * @param path - Route path
   * @param handler - Handler function to invoke when route is matched
   */
  post(router: TRouter, path: string, handler: StepHandler<TRequest, TResponse>): void

  /**
   * Convert native request to framework-agnostic StepRequest
   *
   * @param req - Native framework request
   * @returns Framework-agnostic request object
   */
  toStepRequest(req: TRequest): StepRequest

  /**
   * Create a StepResponse that wraps the native response
   *
   * The returned object provides methods that write directly to the native response.
   *
   * @param res - Native framework response
   * @returns StepResponse with methods for setting headers and cookies
   */
  toStepResponse(res: TResponse): StepResponse

  /**
   * Get the base URL from the request (for relative redirect resolution)
   *
   * @param req - Native framework request
   * @returns Base URL path (e.g., '/forms/my-journey')
   */
  getBaseUrl(req: TRequest): string

  /**
   * Send a redirect response
   *
   * @param res - Native framework response
   * @param url - URL to redirect to
   */
  redirect(res: TResponse, url: string): void

  /**
   * Register a route that redirects to another path
   *
   * @param router - Router to register the redirect on
   * @param fromPath - Path to redirect from
   * @param toPath - Path to redirect to
   */
  registerRedirect(router: TRouter, fromPath: string, toPath: string): void

  /**
   * Forward an error to the framework's error handler
   *
   * @param res - Native framework response
   * @param error - Error to forward
   * @param next - Framework's next function (if applicable)
   */
  forwardError(res: TResponse, error: unknown, next?: (error?: unknown) => void): void

  /**
   * Render a full page from RenderContext and send the response
   *
   * This method handles the complete rendering pipeline:
   * 1. Renders each block to HTML via ComponentRegistry
   * 2. Renders the page template with the block HTML and context data
   * 3. Sends the HTML response
   *
   * @param context - RenderContext containing template, blocks (as data), and metadata
   * @param req - Native framework request (for accessing app.locals, etc.)
   * @param res - Native framework response (for accessing res.locals and sending response)
   */
  render(context: RenderContext, req: TRequest, res: TResponse): Promise<void>
}
