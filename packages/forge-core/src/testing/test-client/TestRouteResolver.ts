import type { ForgeRoute, ForgeTopology } from '../../framework/types/topology.type'
import type { HttpMethod } from '../../framework/types/request.type'
import { extractPathname } from '../../framework/path/routePath'

export interface ResolvedRoute {
  readonly route: ForgeRoute
  readonly params: Record<string, string>
}

interface PathSegment {
  readonly type: 'static' | 'param'
  readonly value: string
}

export default class TestRouteResolver {
  static resolve(path: string, method: HttpMethod, topology: ForgeTopology): ResolvedRoute {
    const pathname = this.normalizePath(extractPathname(path))

    const match = topology.routes
      .map(route => this.matchRoute(route, pathname))
      .find((candidate): candidate is ResolvedRoute => candidate !== undefined)

    if (match === undefined) {
      throw new Error(`No route matched ${method} ${path}`)
    }

    return match
  }

  private static matchRoute(route: ForgeRoute, pathname: string): ResolvedRoute | undefined {
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
