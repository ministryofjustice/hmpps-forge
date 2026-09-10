import type { ForgeRoute, ForgeTopology, HttpMethod } from '@ministryofjustice/hmpps-forge/core/framework'
import BrowserNavigationUrl from './BrowserNavigationUrl'

export interface ResolvedBrowserRoute {
  readonly route: ForgeRoute
  readonly params: Record<string, string>
}

interface PathSegment {
  readonly type: 'static' | 'param'
  readonly value: string
}

/**
 * Matches a pathname and method against the mounted topology. Returns
 * `undefined` for a path outside the mounted journeys - the adapter falls back
 * to a hard navigation there, so an unmatched path is an expected outcome.
 */
export default class BrowserRouteResolver {
  static resolve(url: string, method: HttpMethod, topology: ForgeTopology): ResolvedBrowserRoute | undefined {
    const pathname = this.normalizePath(BrowserNavigationUrl.resolve(url, 'https://forge.invalid/').getPathname())

    return topology.routes
      .filter(route => route.methods.includes(method))
      .map(route => this.matchRoute(route, pathname))
      .find((candidate): candidate is ResolvedBrowserRoute => candidate !== undefined)
  }

  private static matchRoute(route: ForgeRoute, pathname: string): ResolvedBrowserRoute | undefined {
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
