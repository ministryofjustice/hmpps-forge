import express from 'express'
import type nunjucks from 'nunjucks'
import createHttpError from 'http-errors'
import type {
  Forge,
  ForgeHtmlRenderDebugBridge,
  ForgeHtmlRenderDebugSink,
  ForgeInstrumentation,
  ForgeInstrumentationSink,
} from '@ministryofjustice/hmpps-forge/core'
import { extractPathname, resolvePathParams } from '@ministryofjustice/hmpps-forge/core/framework'
import type {
  ForgeEffects,
  ForgeErrorCode,
  ForgeOutcome,
  ForgeRoute,
  HttpMethod,
  Logger,
  RequestSnapshot,
} from '@ministryofjustice/hmpps-forge/core/framework'
import TemplateRenderer from '../renderer/TemplateRenderer'
import { RequestWithState } from './types'

export interface ExpressForgeRouterOptions {
  /** Nunjucks environment for page template rendering. */
  nunjucksEnv: nunjucks.Environment

  /**
   * Default template to use when no template is specified in step or ancestors.
   * Defaults to 'form-step'. The .njk extension is appended automatically if not present.
   */
  defaultTemplate?: string
}

/**
 * Build an Express router that serves a configured {@link Forge} instance.
 *
 * The router owns the Express lifecycle: it registers a route per entry in
 * `forge.getTopology()`, converts each incoming request to a
 * {@link RequestSnapshot}, calls `forge.evaluate()`, flushes the resulting
 * effects onto the response, and dispatches the outcome (render / redirect /
 * error). The engine itself never touches Express.
 *
 * @example
 * ```typescript
 * const forge = new Forge({ logger }).registerPackage(myPackage)
 * app.use(createExpressRouter(forge, { nunjucksEnv }))
 * ```
 */
export function createExpressRouter(forge: Forge, options: ExpressForgeRouterOptions): express.Router {
  const instrumentation = forge.getInstrumentation()
  const logger = forge.getLogger()
  const templateRenderer = new TemplateRenderer({
    nunjucksEnv: options.nunjucksEnv,
    instrumentation,
    defaultTemplate: options.defaultTemplate,
    htmlRenderDebugBridge: findHtmlRenderDebugBridge(instrumentation.getSinks()),
  })
  const router = express.Router({ mergeParams: true })

  forge.getTopology().routes.forEach(route => {
    const handler = createHandler(forge, route, instrumentation, logger, templateRenderer)

    route.methods.forEach(method => {
      if (method === 'GET') {
        router.get(route.templatePath, handler)
      } else {
        router.post(route.templatePath, handler)
      }
    })
  })

  return router
}

function createHandler(
  forge: Forge,
  route: ForgeRoute,
  instrumentation: ForgeInstrumentation,
  logger: Logger | Console,
  templateRenderer: TemplateRenderer,
): express.RequestHandler {
  return (req, res, next) => {
    const requestPath = extractPathname(req.originalUrl ?? req.path)
    const reqWithState = req as RequestWithState

    reqWithState.state = { ...res.locals, ...reqWithState.state }

    logger.debug(`${req.method} request to step at path ${requestPath}`)

    const snapshot = toSnapshot(route, req, res)

    return (
      instrumentation
        .spanAsync('forge-request', async span => {
          span.setAttribute('http.method', req.method)

          const outcome = await forge.evaluate(snapshot)

          applyOutcome(outcome, req, res, next, templateRenderer)
        })
        .catch(next)
    )
  }
}

function toSnapshot(route: ForgeRoute, req: express.Request, res: express.Response): RequestSnapshot {
  const headers = req.headers as Record<string, string | string[] | undefined>
  const cookies = (req.cookies as Record<string, string | undefined>) ?? {}
  const params = normalizeParams(req.params)
  const query = (req.query as Record<string, string | string[]>) ?? {}
  const post = (req.body as Record<string, string | string[]>) ?? {}
  const state = { ...res.locals, ...(req as RequestWithState).state }
  const origin = `${req.protocol}://${req.host}`
  const href = `${origin}${req.originalUrl}`
  const pathname = extractPathname(req.originalUrl)
  const basePath = resolvePathParams(route.basePath, params)

  return {
    nodeId: route.nodeId,
    method: req.method as HttpMethod,
    location: { origin, href, pathname, basePath },
    params,
    query,
    post,
    headers,
    cookies,
    state,
    session: req.session,
  }
}

function applyOutcome(
  outcome: ForgeOutcome,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
  templateRenderer: TemplateRenderer,
): void {
  flushEffects(outcome.effects, res)

  if (outcome.kind === 'navigate') {
    res.redirect(outcome.url)
    return
  }

  if (outcome.kind === 'error') {
    next(createHttpError(errorCodeToStatus(outcome.error.code), outcome.error.message))
    return
  }

  const locals = {
    ...req.app.locals,
    ...res.locals,
  }

  const html = templateRenderer.render(outcome.context, locals, outcome.componentRegistry)

  res.type('html').send(html)
}

function flushEffects(effects: ForgeEffects, res: express.Response): void {
  effects.headers.forEach((value, name) => {
    res.setHeader(name, value)
  })
  effects.cookies.forEach((cookie, name) => {
    if (cookie.options) {
      res.cookie(name, cookie.value, cookie.options)
      return
    }

    res.cookie(name, cookie.value)
  })
}

function normalizeParams(params: Record<string, string | string[] | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .map(([name, value]) => [name, Array.isArray(value) ? value[0] : value])
      .filter((entry): entry is [string, string] => entry[1] !== undefined),
  )
}

function findHtmlRenderDebugBridge(sinks: ForgeInstrumentationSink[]): ForgeHtmlRenderDebugBridge | undefined {
  for (const sink of sinks) {
    if (isHtmlRenderDebugSink(sink)) {
      return sink.getHtmlRenderDebugBridge()
    }
  }

  return undefined
}

function isHtmlRenderDebugSink(sink: ForgeInstrumentationSink): sink is ForgeHtmlRenderDebugSink {
  return 'getHtmlRenderDebugBridge' in sink &&
    typeof (sink as ForgeHtmlRenderDebugSink).getHtmlRenderDebugBridge === 'function'
}

const ERROR_CODE_STATUS: Record<ForgeErrorCode, number> = {
  'node-not-found': 404,
  'method-not-supported': 405,
}

function errorCodeToStatus(code: ForgeErrorCode): number {
  return ERROR_CODE_STATUS[code]
}
