import express from 'express'
import {
  FrameworkAdapter,
  FrameworkAdapterBuilder,
  FrameworkAdapterDependencies,
  StepHandler,
  StepRequest,
} from '@form-engine/core/runtime/routes/types'
import { RenderContext } from '@form-engine/core/runtime/rendering/types'
import ComponentRegistry from '@form-engine/registry/ComponentRegistry'
import nunjucks from 'nunjucks'
import TemplateRenderer from '@form-engine-express-nunjucks/renderer/TemplateRenderer'
import { RequestWithState } from '@form-engine-express-nunjucks/adapter/types'

export interface ExpressFrameworkAdapterUserOptions {
  /**
   * Nunjucks environment for page template rendering.
   */
  nunjucksEnv: nunjucks.Environment

  /**
   * Default template to use when no template is specified in step or ancestors.
   * Defaults to 'form-step'. The .njk extension is appended automatically if not present.
   */
  defaultTemplate?: string
}

export interface ExpressFrameworkAdapterFullOptions extends ExpressFrameworkAdapterUserOptions {
  componentRegistry: ComponentRegistry
}

/**
 * Framework adapter for Express.js with Nunjucks rendering
 * Handles routing (Express-specific concerns) and delegates
 * block/template rendering to TemplateRenderer.
 */
export default class ExpressFrameworkAdapter
  implements FrameworkAdapter<express.Router, express.Request, express.Response>
{
  private readonly templateRenderer: TemplateRenderer

  /**
   * Configure an Express framework adapter builder
   *
   * @param options - User configuration including nunjucks environment
   * @returns Builder that FormEngine will use to create the adapter
   *
   * @example
   * ```typescript
   * const formEngine = new FormEngine({
   *   frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }),
   * })
   * ```
   */
  static configure(
    options: ExpressFrameworkAdapterUserOptions,
  ): FrameworkAdapterBuilder<express.Router, express.Request, express.Response> {
    return {
      build: (deps: FrameworkAdapterDependencies) =>
        new ExpressFrameworkAdapter({
          ...options,
          componentRegistry: deps.componentRegistry,
        }),
    }
  }

  /**
   * Create an Express framework adapter with Nunjucks rendering
   */
  private constructor(options: ExpressFrameworkAdapterFullOptions) {
    this.templateRenderer = new TemplateRenderer({
      nunjucksEnv: options.nunjucksEnv,
      componentRegistry: options.componentRegistry,
      defaultTemplate: options.defaultTemplate,
    })
  }

  /** Create an Express router with merged params enabled */
  createRouter(): express.Router {
    return express.Router({ mergeParams: true })
  }

  /** Mount a child router at a path on a parent router */
  mountRouter(parent: express.Router, path: string, child: express.Router): void {
    parent.use(path, child)
  }

  /** Register a GET route with async error handling */
  get(router: express.Router, path: string, handler: StepHandler<express.Request, express.Response>): void {
    router.get(path, this.wrapHandler(handler))
  }

  /** Register a POST route with async error handling */
  post(router: express.Router, path: string, handler: StepHandler<express.Request, express.Response>): void {
    router.post(path, this.wrapHandler(handler))
  }

  /** Convert Express request to framework-agnostic StepRequest */
  toStepRequest(req: RequestWithState): StepRequest {
    return {
      method: req.method as 'GET' | 'POST',
      post: (req.body as Record<string, unknown>) ?? {},
      query: (req.query as Record<string, unknown>) ?? {},
      params: req.params,
      path: req.path,
      session: req.session,
      state: req.state ?? {},
    }
  }

  /**
   * Get the base URL path from the request with resolved parameter values.
   *
   * Express's req.baseUrl returns route patterns with unresolved placeholders (e.g., '/goal/:uuid').
   * We need the actual URL with substituted values (e.g., '/goal/89e9a810-...').
   * Calculate this by stripping req.path from req.originalUrl.
   */
  getBaseUrl(req: express.Request): string {
    const originalUrl = req.originalUrl
    const path = req.path

    if (path && originalUrl.endsWith(path)) {
      return originalUrl.slice(0, -path.length)
    }

    return req.baseUrl
  }

  /** Send an HTTP redirect response */
  redirect(res: express.Response, url: string): void {
    res.redirect(url)
  }

  /** Register a route that redirects to another path */
  registerRedirect(router: express.Router, fromPath: string, toPath: string): void {
    router.get(fromPath, (_req, res) => {
      res.redirect(toPath)
    })
  }

  /** Render a full page from RenderContext and send the HTML response */
  async render(context: RenderContext, req: express.Request, res: express.Response): Promise<void> {
    const locals = {
      ...req.app.locals,
      ...res.locals,
    }

    const html = await this.templateRenderer.render(context, locals)

    res.type('html').send(html)
  }

  /** Wrap a step handler to convert request and catch async errors */
  private wrapHandler(handler: StepHandler<express.Request, express.Response>): express.RequestHandler {
    return (req, res, next) => {
      const stepRequest = this.toStepRequest(req as RequestWithState)

      handler(stepRequest, req, res).catch(next)
    }
  }

  /** Forward an error to Express error handling middleware */
  forwardError(res: express.Response, error: unknown, next?: express.NextFunction): void {
    if (next) {
      next(error)
    } else {
      throw error
    }
  }
}
