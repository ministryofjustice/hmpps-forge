import type { ForgeRoute, ForgeTopology, HttpMethod, RouteMethod } from '@ministryofjustice/hmpps-forge/core/framework'
import { extractPathname } from '@ministryofjustice/hmpps-forge/core/framework'

export type NextRouteResolution =
  | { readonly kind: 'matched'; readonly route: ForgeRoute; readonly params: Record<string, string> }
  | { readonly kind: 'method-not-allowed'; readonly allowed: readonly RouteMethod[] }
  | { readonly kind: 'not-found' }

interface PathSegment {
  readonly type: 'static' | 'param'
  readonly value: string
}

interface RouteMatch {
  readonly route: ForgeRoute
  readonly params: Record<string, string>
}

export default class NextRouteResolver {
  static resolve(topology: ForgeTopology, method: HttpMethod, pathname: string): NextRouteResolution {
    const normalizedPath = this.normalizePath(extractPathname(pathname))

    const match = topology.routes
      .map(route => this.matchRoute(route, normalizedPath))
      .find((candidate): candidate is RouteMatch => candidate !== undefined)

    if (match === undefined) {
      return { kind: 'not-found' }
    }

    if (!match.route.methods.includes(method)) {
      return { kind: 'method-not-allowed', allowed: match.route.methods }
    }

    return { kind: 'matched', route: match.route, params: match.params }
  }

  private static matchRoute(route: ForgeRoute, pathname: string): RouteMatch | undefined {
    const params = this.matchPath(route.templatePath, pathname)

    if (params === undefined) {
      return undefined
    }

    return { route, params }
  }

  private static matchPath(pattern: string, path: string): Record<string, string> | undefined {
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

    if (!matched) {
      return undefined
    }

    return params
  }

  private static parseSegments(path: string): PathSegment[] {
    return (
      this.normalizePath(path)
        .split('/')
        .filter(Boolean)
        .map((segment): PathSegment => {
          if (segment.startsWith(':')) {
            return { type: 'param', value: segment.slice(1) }
          }

          return { type: 'static', value: segment }
        })
    )
  }

  private static normalizePath(path: string): string {
    const withLeadingSlash = path.startsWith('/') ? path : `/${path}`

    if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')) {
      return withLeadingSlash.slice(0, -1)
    }

    return withLeadingSlash
  }
}
