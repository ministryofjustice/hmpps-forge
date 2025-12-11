import { HttpMethod } from '@form-engine/core/ast/thunks/types'
import { RenderContext } from '@form-engine/core/runtime/rendering/types'
import ComponentRegistry from '@form-engine/registry/ComponentRegistry'

/**
 * Dependencies provided by FormEngine when building an adapter
 */
export interface FrameworkAdapterDependencies {
  componentRegistry: ComponentRegistry
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

export interface StepRequest {
  method: HttpMethod
  post: Record<string, unknown>
  query: Record<string, unknown>
  params: Record<string, string>
  path: string
  session?: unknown
  state?: Record<string, unknown>
}

/**
 * Controller interface for handling step requests
 *
 * Controllers are responsible for processing requests and sending responses
 * directly via the framework adapter. They handle:
 * - Request evaluation and validation
 * - Lifecycle hooks (access, submission)
 * - Response rendering or redirecting
 *
 * @typeParam TRequest - Framework-specific request type
 * @typeParam TResponse - Framework-specific response type
 */
export interface StepController<TRequest, TResponse> {
  get(request: StepRequest, req: TRequest, res: TResponse): Promise<void>
  post(request: StepRequest, req: TRequest, res: TResponse): Promise<void>
}

/**
 * Framework-agnostic step handler function
 *
 * Called by the framework adapter after converting the native request.
 * The adapter handles error wrapping and framework-specific details.
 */
export type StepHandler<TRequest, TResponse> = (request: StepRequest, req: TRequest, res: TResponse) => Promise<void>

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
   * The adapter is responsible for:
   * - Converting native request to StepRequest via toStepRequest()
   * - Wrapping the handler with error handling
   * - Forwarding errors to the framework's error handler
   *
   * @param router - Router to register the route on
   * @param path - Route path
   * @param handler - Handler function to invoke when route is matched
   */
  get(router: TRouter, path: string, handler: StepHandler<TRequest, TResponse>): void

  /**
   * Register a POST route handler
   *
   * The adapter is responsible for:
   * - Converting native request to StepRequest via toStepRequest()
   * - Wrapping the handler with error handling
   * - Forwarding errors to the framework's error handler
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
