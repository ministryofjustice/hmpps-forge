import express from 'express'
import type nunjucks from 'nunjucks'
import createHttpError from 'http-errors'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import { ForgeOrchestrator } from '@ministryofjustice/hmpps-forge/core'
import { extractPathname, resolvePathParams } from '@ministryofjustice/hmpps-forge/core/framework'
import type {
  CookieMutation,
  ForgeErrorCode,
  ForgeOutcome,
  ForgeRoute,
  HttpMethod,
  Logger,
  RequestSnapshot,
  ResponseBindings,
} from '@ministryofjustice/hmpps-forge/core/framework'
import NunjucksRenderer from '../renderer/NunjucksRenderer'
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

export function createExpressRouter(forge: Forge, options: ExpressForgeRouterOptions): express.Router {
  const logger = forge.getLogger()

  const renderer = new NunjucksRenderer({
    nunjucksEnv: options.nunjucksEnv,
    defaultTemplate: options.defaultTemplate,
  })

  const orchestrator = new ForgeOrchestrator({ core: forge, renderer })
  const router = express.Router({ mergeParams: true })

  orchestrator.getTopology().routes.forEach(route => {
    const handler = createHandler(orchestrator, route, logger)

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
  orchestrator: ForgeOrchestrator<string>,
  route: ForgeRoute,
  logger: Logger | Console,
): express.RequestHandler {
  return async (req, res, next) => {
    const requestPath = extractPathname(req.originalUrl ?? req.path)
    const reqWithState = req as RequestWithState

    reqWithState.state = { ...res.locals, ...reqWithState.state }

    logger.debug(`${req.method} request to step at path ${requestPath}`)

    const snapshot = toSnapshot(route, req, res)
    const response = createExpressResponseBindings(res)

    try {
      const outcome = await orchestrator.evaluate(snapshot, { response })

      applyOutcome(outcome, req, res, next)
    } catch (error) {
      next(error)
    }
  }
}

function toSnapshot(route: ForgeRoute, req: express.Request, res: express.Response): RequestSnapshot {
  const headers = req.headers as Record<string, string | string[] | undefined>
  const cookies = (req.cookies as Record<string, string | undefined>) ?? {}
  const params = normalizeParams(req.params)
  const query = (req.query as Record<string, string | string[]>) ?? {}
  const post = (req.body as Record<string, string | string[]>) ?? {}
  const state = { ...res.locals, ...(req as RequestWithState).state }
  const origin = `${req.protocol}://${req.hostname}`
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

function createExpressResponseBindings(res: express.Response): ResponseBindings {
  const cookieCache = new Map<string, CookieMutation>()

  return {
    setHeader(name, value) {
      res.setHeader(name, value)
    },
    getHeader(name) {
      return res.getHeader(name) as string | undefined
    },
    getAllHeaders() {
      const headers = new Map<string, string>()
      const raw = res.getHeaders()

      Object.entries(raw).forEach(([name, value]) => {
        if (typeof value === 'string') {
          headers.set(name, value)
        }
      })

      return headers
    },
    setCookie(name, value, options) {
      res.cookie(name, value, options ?? {})
      cookieCache.set(name, { value, options })
    },
    getCookie(name) {
      return cookieCache.get(name)
    },
    getAllCookies() {
      return cookieCache
    },
  }
}

function applyOutcome(
  outcome: ForgeOutcome<string>,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  if (outcome.kind === 'navigate') {
    res.redirect(outcome.url)
    return
  }

  if (outcome.kind === 'error') {
    next(createHttpError(errorCodeToStatus(outcome.error.code), outcome.error.message))
    return
  }

  if (outcome.output) {
    res.type('html').send(outcome.output)
    return
  }

  next(createHttpError(500, 'Render outcome produced no output — renderer not bound'))
}

function normalizeParams(params: Record<string, string | string[] | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .map(([name, value]) => [name, Array.isArray(value) ? value[0] : value])
      .filter((entry): entry is [string, string] => entry[1] !== undefined),
  )
}

const ERROR_CODE_STATUS: Record<ForgeErrorCode, number> = {
  'node-not-found': 404,
  'method-not-supported': 405,
}

function errorCodeToStatus(code: ForgeErrorCode): number {
  return ERROR_CODE_STATUS[code]
}
