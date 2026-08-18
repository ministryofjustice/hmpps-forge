import type { HttpMethod, RequestLocation } from '../../framework/types/request.type'
import type { RequestSnapshot } from '../../framework/types/snapshot.type'
import { resolvePathParams } from '../../shared/routePath'
import { extractPathname } from '../extractPathname'
import type { ResolvedRoute } from './TestRouteResolver'
import type { TestRequestOptions } from './testResult.type'

export default class TestSnapshotFactory {
  static create(
    method: HttpMethod,
    path: string,
    resolved: ResolvedRoute,
    options?: TestRequestOptions,
  ): RequestSnapshot {
    const params = { ...options?.params, ...resolved.params }
    const location = this.createRequestLocation(path, resolved, params)

    return {
      nodeId: resolved.route.nodeId,
      method,
      location,
      params,
      query: options?.query ?? {},
      post: options?.body ?? {},
      headers: this.normalizeHeaders(options?.headers ?? {}),
      cookies: options?.cookies ?? {},
      state: options?.state ?? {},
      session: options?.session,
    }
  }

  private static createRequestLocation(
    path: string,
    resolved: ResolvedRoute,
    params: Record<string, string>,
  ): RequestLocation {
    const origin = 'http://localhost'
    const pathname = extractPathname(path)
    const basePath = resolvePathParams(resolved.route.basePath, params)

    return { origin, href: `${origin}${path}`, pathname, basePath }
  }

  private static normalizeHeaders(headers: Record<string, string | string[]>): Record<string, string | string[]> {
    const normalized: Record<string, string | string[]> = {}

    Object.entries(headers).forEach(([key, value]) => {
      normalized[key.toLowerCase()] = value
    })

    return normalized
  }
}
