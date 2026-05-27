import type { HttpMethod } from '../framework/types/request.type'
import type { CookieMutation } from '../framework/types/response.type'
import type { TestRequest, TestRequestOptions, TestResponse, TestResult, TestRouter, TestRoute } from './types'

interface PathSegment {
  type: 'static' | 'param'
  value: string
}

interface PathMatchResult {
  params: Record<string, string>
}

interface ResolvedRoute {
  route: TestRoute
  params: Record<string, string>
  basePath: string
}

function parseSegments(pattern: string): PathSegment[] {
  const normalized = pattern.startsWith('/') ? pattern : `/${pattern}`
  const trimmed = normalized.length > 1 && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized

  return (
    trimmed
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

function matchSegments(patternSegments: PathSegment[], pathSegments: string[]): PathMatchResult | undefined {
  if (patternSegments.length !== pathSegments.length) {
    return undefined
  }

  const params: Record<string, string> = {}

  for (let i = 0; i < patternSegments.length; i++) {
    const segment = patternSegments[i]
    const actual = pathSegments[i]

    if (segment.type === 'param') {
      params[segment.value] = actual
    } else if (segment.value !== actual) {
      return undefined
    }
  }

  return { params }
}

function matchPath(pattern: string, path: string): PathMatchResult | undefined {
  const patternSegments = parseSegments(pattern)
  const pathSegments = (path.startsWith('/') ? path : `/${path}`).split('/').filter(Boolean)

  return matchSegments(patternSegments, pathSegments)
}

function matchPrefix(pattern: string, path: string): { params: Record<string, string>; remaining: string } | undefined {
  const patternSegments = parseSegments(pattern)
  const pathSegments = (path.startsWith('/') ? path : `/${path}`).split('/').filter(Boolean)

  if (pathSegments.length < patternSegments.length) {
    return undefined
  }

  const result = matchSegments(patternSegments, pathSegments.slice(0, patternSegments.length))

  if (!result) {
    return undefined
  }

  const remainingSegments = pathSegments.slice(patternSegments.length)
  const remaining = remainingSegments.length > 0 ? `/${remainingSegments.join('/')}` : '/'

  return { params: result.params, remaining }
}

/**
 * Test client for sending requests to a Forge instance and inspecting the results.
 *
 * Each call returns a {@link TestResult} containing either the
 * {@link RenderContext} or redirect URL, plus any response headers and
 * cookies set during the request.
 *
 * @example
 * ```typescript
 * const result = await client.get('/my-journey/step-one', {
 *   session: { answers: { name: 'John' } },
 * })
 *
 * if (result.type === 'render') {
 *   expect(result.context.blocks).toHaveLength(3)
 * }
 * ```
 */
export class ForgeTestClient {

  constructor(private readonly router: TestRouter) {}

  /** Dispatch a GET request to the given path. */
  async get(path: string, options?: TestRequestOptions): Promise<TestResult> {
    return this.dispatch('GET', path, options)
  }

  /** Dispatch a POST request to the given path. */
  async post(path: string, options?: TestRequestOptions): Promise<TestResult> {
    return this.dispatch('POST', path, options)
  }

  private async dispatch(method: HttpMethod, path: string, options?: TestRequestOptions): Promise<TestResult> {
    const resolved = this.resolveRoute(path)

    if (!resolved) {
      throw new Error(`No route matched for path: ${path}`)
    }

    const routeHandler = method === 'GET' ? resolved.route.get : resolved.route.post

    if (!routeHandler) {
      throw new Error(`No ${method} handler registered for path: ${path}`)
    }

    const mergedParams = { ...resolved.params, ...options?.params }

    const req = this.buildRequest(method, path, resolved.basePath, mergedParams, options)
    const res = this.buildResponse()

    await routeHandler.handler(req, res)

    return this.buildResult(res)
  }

  private resolveRoute(path: string): ResolvedRoute | undefined {
    return this.resolveRouteInRouter(this.router, path, '', {})
  }

  private resolveRouteInRouter(
    router: TestRouter,
    remainingPath: string,
    currentBase: string,
    inheritedParams: Record<string, string>,
  ): ResolvedRoute | undefined {
    for (const [routePath, route] of router.routes) {
      const fullPattern = routePath === '/' ? '' : routePath
      const match = matchPath(fullPattern, remainingPath)

      if (match) {
        return {
          route,
          params: { ...inheritedParams, ...match.params },
          basePath: currentBase,
        }
      }
    }

    for (const [mountPath, childRouter] of router.children) {
      const prefixMatch = matchPrefix(mountPath, remainingPath)

      if (prefixMatch) {
        const newBase = `${currentBase}${mountPath}`
        const mergedParams = { ...inheritedParams, ...prefixMatch.params }
        const childResult = this.resolveRouteInRouter(childRouter, prefixMatch.remaining, newBase, mergedParams)

        if (childResult) {
          return childResult
        }
      }
    }

    return undefined
  }

  private buildRequest(
    method: HttpMethod,
    path: string,
    basePath: string,
    params: Record<string, string>,
    options?: TestRequestOptions,
  ): TestRequest {
    const url = `http://localhost${path}`

    return {
      method,
      url,
      baseUrl: basePath,
      headers: this.normalizeHeaders(options?.headers ?? {}),
      cookies: options?.cookies ?? {},
      params,
      query: options?.query ?? {},
      body: options?.body ?? {},
      session: options?.session,
      state: options?.state ?? {},
    }
  }

  private normalizeHeaders(headers: Record<string, string | string[]>): Record<string, string | string[]> {
    const normalized: Record<string, string | string[]> = {}

    Object.entries(headers).forEach(([key, value]) => {
      normalized[key.toLowerCase()] = value
    })

    return normalized
  }

  private buildResponse(): TestResponse {
    return {
      headers: new Map<string, string>(),
      cookies: new Map<string, CookieMutation>(),
    }
  }

  private buildResult(res: TestResponse): TestResult {
    if (res.redirectUrl !== undefined) {
      return {
        type: 'redirect',
        url: res.redirectUrl,
        headers: res.headers,
        cookies: res.cookies,
      }
    }

    if (res.renderContext !== undefined) {
      const context = res.renderContext

      return {
        type: 'render',
        context,
        headers: res.headers,
        cookies: res.cookies,
        getBlocksByVariant: (variant: string) => context.blocks.filter(b => b.variant === variant),
        getValidationErrorsByFieldCode: (fieldCode: string) =>
          context.fieldValidationErrors.filter(e => e.blockCode === fieldCode),
      }
    }

    throw new Error('Request handler completed without rendering or redirecting')
  }
}
