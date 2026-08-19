import type express from 'express'
import type {
  ForgeRoute,
  HttpMethod,
  RequestLocation,
  RequestSnapshot,
} from '@ministryofjustice/hmpps-forge/core/framework'
import { extractPathname, resolvePathParams } from './routePath'
import type { RequestWithState } from './types'

export default class ExpressSnapshotFactory {
  static create(route: ForgeRoute, req: express.Request, res: express.Response): RequestSnapshot {
    const params = this.normalizeParams(req.params)
    const location = this.createRequestLocation(route, req, params)

    return {
      nodeId: route.nodeId,
      method: this.normalizeMethod(req.method),
      location,
      params,
      query: this.normalizeQuery(req.query),
      post: this.normalizePost(req.body),
      headers: this.normalizeHeaders(req.headers),
      cookies: this.normalizeCookies(req.cookies),
      state: this.createRequestState(req, res),
      session: req.session,
    }
  }

  private static createRequestLocation(
    route: ForgeRoute,
    req: express.Request,
    params: Record<string, string>,
  ): RequestLocation {
    const origin = `${req.protocol}://${req.hostname}`
    const href = `${origin}${req.originalUrl}`
    const pathname = extractPathname(req.originalUrl)
    const basePath = resolvePathParams(route.basePath, params)

    return { origin, href, pathname, basePath }
  }

  private static createRequestState(req: express.Request, res: express.Response): Record<string, unknown> {
    const { settings: _expressSettings, ...appLocals } = req.app.locals
    const requestState = (req as RequestWithState).state ?? {}

    return { ...appLocals, ...res.locals, ...requestState }
  }

  private static normalizeMethod(method: string): HttpMethod {
    if (method === 'HEAD') {
      return 'GET'
    }

    if (method === 'GET' || method === 'POST') {
      return method
    }

    throw new TypeError(`Unsupported HTTP method: ${method}`)
  }

  private static normalizeParams(params: Record<string, string | string[] | undefined>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(params)
        .map(([name, value]) => [name, Array.isArray(value) ? value[0] : value])
        .filter((entry): entry is [string, string] => entry[1] !== undefined),
    )
  }

  private static normalizeHeaders(headers: express.Request['headers']): Record<string, string | string[] | undefined> {
    return headers as Record<string, string | string[] | undefined>
  }

  private static normalizeCookies(cookies: unknown): Record<string, string | undefined> {
    return (cookies as Record<string, string | undefined>) ?? {}
  }

  private static normalizeQuery(query: express.Request['query']): Record<string, string | string[]> {
    return (query as Record<string, string | string[]>) ?? {}
  }

  private static normalizePost(body: unknown): Record<string, unknown> {
    return (body as Record<string, unknown>) ?? {}
  }
}
