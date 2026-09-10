import type { HttpMethod, RequestLocation, RequestSnapshot } from '@ministryofjustice/hmpps-forge/core/framework'
import BrowserNavigationUrl from './BrowserNavigationUrl'
import type { ResolvedBrowserRoute } from './BrowserRouteResolver'
import { resolvePathParams } from './routePath'
import type { BrowserLocationSnapshot } from './types'

export interface BrowserSnapshotInputs {
  readonly method: HttpMethod
  readonly url: string
  readonly resolved: ResolvedBrowserRoute
  readonly location: BrowserLocationSnapshot
  readonly body?: Record<string, unknown>
  readonly session: unknown
}

/**
 * Builds the engine's `RequestSnapshot` from a browser interaction. Headers
 * and cookies stay empty - there is no HTTP request - and state carries
 * nothing by default; the session object is the adapter's own.
 */
export default class BrowserSnapshotFactory {
  static create(inputs: BrowserSnapshotInputs): RequestSnapshot {
    const { params } = inputs.resolved
    const requestUrl = BrowserNavigationUrl.resolve(inputs.url, inputs.location.href)

    return {
      nodeId: inputs.resolved.route.nodeId,
      method: inputs.method,
      location: this.createRequestLocation(inputs, params, requestUrl),
      params,
      query: requestUrl.getQuery(),
      post: inputs.body ?? {},
      headers: {},
      cookies: {},
      state: {},
      session: inputs.session,
    }
  }

  private static createRequestLocation(
    inputs: BrowserSnapshotInputs,
    params: Record<string, string>,
    requestUrl: BrowserNavigationUrl,
  ): RequestLocation {
    const basePath = resolvePathParams(inputs.resolved.route.basePath, params)

    return {
      origin: requestUrl.getOrigin(),
      href: requestUrl.toRequestHref(),
      pathname: requestUrl.getPathname(),
      basePath,
    }
  }
}
