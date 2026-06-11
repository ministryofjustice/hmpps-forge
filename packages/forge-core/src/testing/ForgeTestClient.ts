import createHttpError from 'http-errors'
import type { HttpMethod, RequestLocation } from '../framework/types/request.type'
import type { RequestSnapshot } from '../framework/types/snapshot.type'
import type { ResponseBindings } from '../framework/types/responseBindings.type'
import type { CookieMutation } from '../framework/types/response.type'
import type { ForgeErrorCode, ForgeOutcome } from '../framework/types/outcome.type'
import type { ForgeRoute } from '../framework/types/topology.type'
import { extractPathname, resolvePathParams } from '../framework/path/routePath'
import type { ForgeEvaluationEngine, TestRequestOptions, TestResult } from './types'

interface PathSegment {
  type: 'static' | 'param'
  value: string
}

interface RouteMatch {
  route: ForgeRoute
  params: Record<string, string>
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

function matchPath(pattern: string, path: string): Record<string, string> | undefined {
  const patternSegments = parseSegments(pattern)
  const pathSegments = (path.startsWith('/') ? path : `/${path}`).split('/').filter(Boolean)

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

  return params
}

/**
 * Test client for sending requests to a Forge instance and inspecting the results.
 *
 * It matches a path against the engine's {@link Forge.getTopology} routes, builds
 * a {@link RequestSnapshot}, runs {@link Forge.evaluate}, and maps the outcome to
 * a {@link TestResult} — exercising the exact path a real adapter takes, without
 * HTTP or HTML rendering.
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
  private readonly routes: ForgeRoute[]

  constructor(private readonly forge: ForgeEvaluationEngine) {
    this.routes = forge.getTopology().routes
  }

  /** Dispatch a GET request to the given path. */
  async get(path: string, options?: TestRequestOptions): Promise<TestResult> {
    return this.dispatch('GET', path, options)
  }

  /** Dispatch a POST request to the given path. */
  async post(path: string, options?: TestRequestOptions): Promise<TestResult> {
    return this.dispatch('POST', path, options)
  }

  private async dispatch(method: HttpMethod, path: string, options?: TestRequestOptions): Promise<TestResult> {
    const match = this.resolveRoute(path)

    if (!match) {
      throw new Error(`No route matched for path: ${path}`)
    }

    const params = { ...match.params, ...options?.params }
    const snapshot = this.buildSnapshot(method, path, match.route, params, options)
    const response = createTestResponseBindings()
    const outcome = await this.forge.evaluate(snapshot, { response })

    return this.toResult(outcome, response)
  }

  private resolveRoute(path: string): RouteMatch | undefined {
    const pathname = extractPathname(path)

    for (const route of this.routes) {
      const params = matchPath(route.templatePath, pathname)

      if (params) {
        return { route, params }
      }
    }

    return undefined
  }

  private buildSnapshot(
    method: HttpMethod,
    path: string,
    route: ForgeRoute,
    params: Record<string, string>,
    options?: TestRequestOptions,
  ): RequestSnapshot {
    const origin = 'http://localhost'
    const pathname = extractPathname(path)
    const location: RequestLocation = {
      origin,
      href: `${origin}${path}`,
      pathname,
      basePath: resolvePathParams(route.basePath, params),
    }

    return {
      nodeId: route.nodeId,
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

  private normalizeHeaders(headers: Record<string, string | string[]>): Record<string, string | string[]> {
    const normalized: Record<string, string | string[]> = {}

    Object.entries(headers).forEach(([key, value]) => {
      normalized[key.toLowerCase()] = value
    })

    return normalized
  }

  private toResult(outcome: ForgeOutcome<unknown>, response: TestResponseBindings): TestResult {
    if (outcome.kind === 'navigate') {
      return {
        type: 'redirect',
        url: outcome.url,
        headers: response.getAllHeaders(),
        cookies: response.getAllCookies(),
      }
    }

    if (outcome.kind === 'error') {
      throw createHttpError(errorCodeToStatus(outcome.error.code), outcome.error.message)
    }

    const { context } = outcome

    return {
      type: 'render',
      context,
      headers: response.getAllHeaders(),
      cookies: response.getAllCookies(),
      getBlocksByVariant: (variant: string) => context.blocks.filter(b => b.variant === variant),
      getValidationErrorsByFieldCode: (fieldCode: string) =>
        context.fieldValidationErrors.filter(e => e.blockCode === fieldCode),
    }
  }
}

interface TestResponseBindings extends ResponseBindings {
  getAllHeaders(): Map<string, string>
  getAllCookies(): Map<string, CookieMutation>
}

function createTestResponseBindings(): TestResponseBindings {
  const headers = new Map<string, string>()
  const cookies = new Map<string, CookieMutation>()

  return {
    setHeader(name, value) {
      headers.set(name, value)
    },
    getHeader(name) {
      return headers.get(name)
    },
    getAllHeaders() {
      return headers
    },
    setCookie(name, value, options) {
      cookies.set(name, { value, options })
    },
    getCookie(name) {
      return cookies.get(name)
    },
    getAllCookies() {
      return cookies
    },
  }
}

const ERROR_CODE_STATUS: Record<ForgeErrorCode, number> = {
  'node-not-found': 404,
  'method-not-supported': 405,
}

function errorCodeToStatus(code: ForgeErrorCode): number {
  return ERROR_CODE_STATUS[code]
}
