import type Logger from 'bunyan'
import express from 'express'
import {
  CookieMutation,
  CookieOptions,
  FrameworkAdapter,
  FrameworkAdapterBuilder,
  FrameworkAdapterDependencies,
  StepHandler,
  StepRequest,
  StepResponse,
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
  logger: Logger | Console
}

/**
 * Framework adapter for Express.js with Nunjucks rendering
 * Handles routing (Express-specific concerns) and delegates
 * block/template rendering to TemplateRenderer.
 */
export default class ExpressFrameworkAdapter implements FrameworkAdapter<
  express.Router,
  express.Request,
  express.Response
> {
  private readonly logger: Logger | Console

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
          logger: deps.logger,
        }),
    }
  }

  /**
   * Create an Express framework adapter with Nunjucks rendering
   */
  private constructor(options: ExpressFrameworkAdapterFullOptions) {
    this.logger = options.logger
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
    const headers = req.headers as Record<string, string | string[] | undefined>
    const cookies = (req.cookies as Record<string, string | undefined>) ?? {}
    const params = req.params
    const query = (req.query as Record<string, string | string[]>) ?? {}
    const post = (req.body as Record<string, string | string[]>) ?? {}
    const state = req.state ?? {}

    return {
      method: req.method as 'GET' | 'POST',
      url: `${req.protocol}://${req.host}${req.originalUrl}`,

      getHeader: (name: string) => headers[name.toLowerCase()],
      getAllHeaders: () => headers,
      getCookie: (name: string) => cookies[name],
      getAllCookies: () => cookies,
      getParam: (name: string) => params[name],
      getParams: () => params,
      getQuery: (name: string) => query[name],
      getAllQuery: () => query,
      getPost: (name: string) => post[name],
      getAllPost: () => post,
      getSession: () => req.session,
      getState: (key: string) => state[key],
      getAllState: () => state,
    }
  }

  /** Create a StepResponse that writes directly to the Express response */
  toStepResponse(res: express.Response): StepResponse {
    return {
      setHeader: (name: string, value: string) => {
        res.setHeader(name, value)
      },
      getHeader: (name: string) => {
        const header = res.getHeader(name)

        return typeof header === 'string' ? header : undefined
      },
      getAllHeaders: () => {
        const result = new Map<string, string>()
        const headerNames = res.getHeaderNames()

        for (const name of headerNames) {
          const value = res.getHeader(name)

          if (typeof value === 'string') {
            result.set(name, value)
          }
        }

        return result
      },
      setCookie: (name: string, value: string, options?: CookieOptions) => {
        res.cookie(name, value, options)
      },
      getCookie: (name: string) => this.parseSetCookieHeader(res).get(name),
      getAllCookies: () => this.parseSetCookieHeader(res),
    }
  }

  /**
   * Parse the Set-Cookie header(s) from the response to get cookies that have been set.
   * This allows effects to read back cookies they or other effects have set.
   */
  private parseSetCookieHeader(res: express.Response): Map<string, CookieMutation> {
    const cookies = new Map<string, CookieMutation>()
    const header = res.getHeader('Set-Cookie')

    if (!header) {
      return cookies
    }

    const headerStrings = Array.isArray(header) ? header : [String(header)]

    for (const headerString of headerStrings) {
      const parsed = this.parseSingleSetCookie(headerString)

      if (parsed) {
        cookies.set(parsed.name, { value: parsed.value, options: parsed.options })
      }
    }

    return cookies
  }

  /**
   * Parse a single Set-Cookie header string into name, value, and options.
   */
  private parseSingleSetCookie(
    headerString: string,
  ): { name: string; value: string; options: CookieOptions } | undefined {
    const parts = headerString.split(';').map(part => part.trim())
    const [nameValue, ...attributes] = parts

    if (!nameValue) {
      return undefined
    }

    const equalsIndex = nameValue.indexOf('=')

    if (equalsIndex === -1) {
      return undefined
    }

    const name = nameValue.slice(0, equalsIndex)
    const value = nameValue.slice(equalsIndex + 1)
    const options: CookieOptions = {}

    for (const attr of attributes) {
      const attrLower = attr.toLowerCase()

      if (attrLower === 'httponly') {
        options.httpOnly = true
      } else if (attrLower === 'secure') {
        options.secure = true
      } else if (attrLower.startsWith('samesite=')) {
        const sameSiteValue = attr.slice(9).toLowerCase()

        if (sameSiteValue === 'strict' || sameSiteValue === 'lax' || sameSiteValue === 'none') {
          options.sameSite = sameSiteValue
        }
      } else if (attrLower.startsWith('max-age=')) {
        options.maxAge = parseInt(attr.slice(8), 10)
      } else if (attrLower.startsWith('path=')) {
        options.path = attr.slice(5)
      } else if (attrLower.startsWith('domain=')) {
        options.domain = attr.slice(7)
      } else if (attrLower.startsWith('expires=')) {
        options.expires = new Date(attr.slice(8))
      }
    }

    return { name, value, options }
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

  /** Wrap a step handler to catch async errors */
  private wrapHandler(handler: StepHandler<express.Request, express.Response>): express.RequestHandler {
    return (req, res, next) => {
      this.logger.debug(`${req.method} request to step at path ${req.path}`)
      handler(req, res).catch(next)
    }
  }

  /** Forward an error to Express error handling middleware */
  forwardError(_res: express.Response, error: unknown, next?: express.NextFunction): void {
    if (next) {
      next(error)
    } else {
      throw error
    }
  }
}
