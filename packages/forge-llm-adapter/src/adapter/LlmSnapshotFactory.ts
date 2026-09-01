import type {
  ForgeRoute,
  ForgeTopology,
  HttpMethod,
  RequestLocation,
  RequestSnapshot,
} from '@ministryofjustice/hmpps-forge/core/framework'

export interface ResolvedLlmRoute {
  readonly route: ForgeRoute
  readonly params: Record<string, string>
}

interface PathSegment {
  readonly type: 'static' | 'param'
  readonly value: string
}

/** Resolves conversational navigation into framework-neutral Forge snapshots. */
export class LlmSnapshotFactory {
  private readonly origin: string

  constructor(origin = 'http://localhost') {
    this.origin = new URL(origin).origin
  }

  resolve(method: HttpMethod, path: string, topology: ForgeTopology): ResolvedLlmRoute | undefined {
    const url = new URL(path, this.origin)

    if (url.origin !== this.origin) {
      return undefined
    }

    return topology.routes
      .filter(route => route.methods.includes(method))
      .map(route => this.matchRoute(route, url.pathname))
      .find((candidate): candidate is ResolvedLlmRoute => candidate !== undefined)
  }

  create(
    method: HttpMethod,
    path: string,
    resolvedRoute: ResolvedLlmRoute,
    session: Record<string, unknown>,
    post: Record<string, unknown> = {},
  ): RequestSnapshot {
    const url = new URL(path, this.origin)
    const location = this.createRequestLocation(url, resolvedRoute)

    return {
      nodeId: resolvedRoute.route.nodeId,
      method,
      location,
      params: resolvedRoute.params,
      query: this.createQuery(url),
      post,
      headers: {},
      cookies: {},
      state: {},
      session,
    }
  }

  private createRequestLocation(url: URL, resolvedRoute: ResolvedLlmRoute): RequestLocation {
    return {
      origin: this.origin,
      href: url.href,
      pathname: url.pathname,
      basePath: this.resolvePathParams(resolvedRoute.route.basePath, resolvedRoute.params),
    }
  }

  private createQuery(url: URL): Record<string, string | string[]> {
    const query: Record<string, string | string[]> = {}

    url.searchParams.forEach((value, name) => {
      const existing = query[name]

      if (existing === undefined) {
        query[name] = value

        return
      }

      query[name] = Array.isArray(existing) ? [...existing, value] : [existing, value]
    })

    return query
  }

  private matchRoute(route: ForgeRoute, pathname: string): ResolvedLlmRoute | undefined {
    const params = this.matchPath(route.templatePath, pathname)

    if (params === undefined) {
      return undefined
    }

    return { route, params }
  }

  private matchPath(pattern: string, path: string): Record<string, string> | undefined {
    const patternSegments = this.parseSegments(pattern)
    const pathSegments = this.parseSegments(path)

    if (patternSegments.length !== pathSegments.length) {
      return undefined
    }

    const params: Record<string, string> = {}
    const matched = patternSegments.every((segment, index) => {
      const actual = pathSegments[index]

      if (actual === undefined) {
        return false
      }

      if (segment.type === 'param') {
        params[segment.value] = actual.value

        return true
      }

      return segment.value === actual.value
    })

    return matched ? params : undefined
  }

  private parseSegments(path: string): PathSegment[] {
    return (
      this.normalizePath(path)
        .split('/')
        .filter(Boolean)
        .map((segment): PathSegment => {
          if (segment.startsWith(':')) {
            return { type: 'param', value: segment.slice(1) }
          }

          return { type: 'static', value: decodeURIComponent(segment) }
        })
    )
  }

  private normalizePath(path: string): string {
    const withLeadingSlash = path.startsWith('/') ? path : `/${path}`

    if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')) {
      return withLeadingSlash.slice(0, -1)
    }

    return withLeadingSlash
  }

  private resolvePathParams(path: string, params: Record<string, string>): string {
    return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, name) => params[name] ?? match)
  }
}
