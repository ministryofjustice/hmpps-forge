import express from 'express'
import createHttpError from 'http-errors'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
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
import { RequestWithState } from './types'

/**
 * Build an Express router that serves a configured {@link Forge} instance.
 *
 * The router owns only the Express transport: it registers a route per entry
 * in `forge.getTopology()`, converts each incoming request to a
 * {@link RequestSnapshot}, calls `forge.evaluate()`, flushes the resulting
 * effects onto the response, and writes the outcome (rendered page / redirect /
 * error). Rendering happens inside the engine via the renderer bound at Forge
 * construction, so the Forge must be `Forge<string>`.
 *
 * @example
 * ```typescript
 * const forge = new Forge({ logger, renderer: new NunjucksRenderer({ nunjucksEnv }) })
 *   .registerPackage(myPackage)
 * app.use(createExpressRouter(forge))
 * ```
 */
export function createExpressRouter(forge: Forge<string>): express.Router {
  const logger = forge.getLogger()
  const router = express.Router({ mergeParams: true })

  forge.getTopology().routes.forEach(route => {
    const handler = createHandler(forge, route, logger)

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

function createHandler(forge: Forge<string>, route: ForgeRoute, logger: Logger | Console): express.RequestHandler {
  return async (req, res, next) => {
    const requestPath = extractPathname(req.originalUrl ?? req.path)
    const reqWithState = req as RequestWithState

    reqWithState.state = { ...res.locals, ...reqWithState.state }

    logger.debug(`${req.method} request to step at path ${requestPath}`)

    const snapshot = toSnapshot(route, req, res)
    const response = createExpressResponseBindings(res)

    try {
      const outcome = await forge.evaluate(snapshot, { response })

      applyOutcome(outcome, res, next)
    } catch (err) {
      next(err)
    }
  }
}

function toSnapshot(route: ForgeRoute, req: express.Request, res: express.Response): RequestSnapshot {
  const headers = req.headers as Record<string, string | string[] | undefined>
  const cookies = (req.cookies as Record<string, string | undefined>) ?? {}
  const params = normalizeParams(req.params)
  const query = (req.query as Record<string, string | string[]>) ?? {}
  const post = (req.body as Record<string, string | string[]>) ?? {}
  // app.locals flow through snapshot state so the renderer's page assembly sees
  // them as template locals; res.locals override them, matching Express precedence.
  const state = { ...req.app.locals, ...res.locals, ...(req as RequestWithState).state }
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

function applyOutcome(outcome: ForgeOutcome<string>, res: express.Response, next: express.NextFunction): void {
  if (outcome.kind === 'navigate') {
    res.redirect(outcome.url)
    return
  }

  if (outcome.kind === 'error') {
    next(createHttpError(errorCodeToStatus(outcome.error.code), outcome.error.message))
    return
  }

  res.type('html').send(outcome.output)
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
