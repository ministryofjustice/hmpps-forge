import type { AdapterRouteMatch } from '@ministryofjustice/hmpps-forge/core'
import { resolvePathParams } from '@ministryofjustice/hmpps-forge/core/framework'
import type {
  CookieMutation,
  CookieOptions,
  ForgeRoute,
  HttpMethod,
  RequestLocation,
  RequestSnapshot,
  ResponseBindings,
} from '@ministryofjustice/hmpps-forge/core/framework'

export type RouteParamValue = string | string[] | undefined

export interface NextRouteContext {
  params?: Promise<Record<string, RouteParamValue>> | Record<string, RouteParamValue>
}

export interface NextForgeSessionStore {
  load(request: Request): Promise<unknown> | unknown
  save(session: unknown, response: Response, request: Request): Promise<void> | void
}

interface PathSegment {
  type: 'static' | 'param'
  value: string
}

export function resolveRoute(
  routes: readonly ForgeRoute[],
  method: HttpMethod,
  path: string,
): AdapterRouteMatch | undefined {
  const match = routes
    .map(route => {
      const params = matchPath(route.templatePath, path)

      return params ? { route, params } : undefined
    })
    .find((routeMatch): routeMatch is Pick<AdapterRouteMatch, 'route' | 'params'> => routeMatch !== undefined)

  return match ? { ...match, method } : undefined
}

export async function toSnapshot(
  route: ForgeRoute,
  params: Record<string, string>,
  method: HttpMethod,
  request: Request,
  session: unknown,
  state: Record<string, unknown>,
  context?: NextRouteContext,
): Promise<RequestSnapshot> {
  const url = new URL(request.url)
  const nextParams = await resolveNextParams(context)
  const mergedParams = { ...normalizeParams(nextParams), ...params }
  const location: RequestLocation = {
    origin: url.origin,
    href: url.href,
    pathname: url.pathname,
    basePath: resolvePathParams(route.basePath, mergedParams),
  }

  return {
    nodeId: route.nodeId,
    method,
    location,
    params: mergedParams,
    query: toQueryRecord(url.searchParams),
    post: method === 'POST' ? await toPostRecord(request) : {},
    headers: toHeaderRecord(request.headers),
    cookies: parseCookieHeader(request.headers.get('cookie')),
    state,
    session,
  }
}

export function normalizeParams(params: Record<string, RouteParamValue>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .map(([name, value]) => [name, Array.isArray(value) ? value.join('/') : value])
      .filter((entry): entry is [string, string] => entry[1] !== undefined),
  )
}

export async function loadSession(request: Request, sessionStore?: NextForgeSessionStore): Promise<unknown> {
  const session = await sessionStore?.load(request)

  return session ?? {}
}

export function createRecordingResponseBindings(): ResponseBindings {
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

export function applyResponseBindings(response: Response, bindings: ResponseBindings): Response {
  bindings.getAllHeaders().forEach((value, name) => {
    response.headers.set(name, value)
  })

  bindings.getAllCookies().forEach((cookie, name) => {
    response.headers.append('set-cookie', serializeCookie(name, cookie.value, cookie.options))
  })

  return response
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
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const trimmedPath =
    normalizedPath.length > 1 && normalizedPath.endsWith('/') ? normalizedPath.slice(0, -1) : normalizedPath
  const pathSegments = trimmedPath.split('/').filter(Boolean)

  if (patternSegments.length !== pathSegments.length) {
    return undefined
  }

  return patternSegments.reduce<Record<string, string> | undefined>((params, segment, index) => {
    if (params === undefined) {
      return undefined
    }

    const actual = pathSegments[index]

    if (segment.type === 'param') {
      return { ...params, [segment.value]: actual }
    }

    return segment.value === actual ? params : undefined
  }, {})
}

async function resolveNextParams(context?: NextRouteContext): Promise<Record<string, RouteParamValue>> {
  if (context?.params === undefined) {
    return {}
  }

  return context.params
}

function toQueryRecord(searchParams: URLSearchParams): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {}

  searchParams.forEach((value, key) => {
    query[key] = appendRecordValue(query[key], value)
  })

  return query
}

async function toPostRecord(request: Request): Promise<Record<string, string | string[]>> {
  const contentType = request.headers.get('content-type') ?? ''

  if (!contentType.includes('application/x-www-form-urlencoded') && !contentType.includes('multipart/form-data')) {
    return {}
  }

  const formData = await request.formData()
  const post: Record<string, string | string[]> = {}

  formData.forEach((value, key) => {
    if (typeof value !== 'string') {
      return
    }

    post[key] = appendRecordValue(post[key], value)
  })

  return post
}

function appendRecordValue(current: string | string[] | undefined, value: string): string | string[] {
  if (current === undefined) {
    return value
  }

  return Array.isArray(current) ? [...current, value] : [current, value]
}

function toHeaderRecord(headers: Headers): Record<string, string | undefined> {
  const record: Record<string, string | undefined> = {}

  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value
  })

  return record
}

function parseCookieHeader(header: string | null): Record<string, string | undefined> {
  if (!header) {
    return {}
  }

  return Object.fromEntries(
    header.split(';').map(cookie => {
      const [rawName, ...rawValue] = cookie.trim().split('=')

      return [decodeURIComponent(rawName), decodeURIComponent(rawValue.join('='))]
    }),
  )
}

function serializeCookie(name: string, value: string, options?: CookieOptions): string {
  const segments = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`]

  if (options?.maxAge !== undefined) {
    segments.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`)
  }

  if (options?.expires !== undefined) {
    segments.push(`Expires=${options.expires.toUTCString()}`)
  }

  if (options?.domain) {
    segments.push(`Domain=${options.domain}`)
  }

  if (options?.path) {
    segments.push(`Path=${options.path}`)
  }

  if (options?.httpOnly) {
    segments.push('HttpOnly')
  }

  if (options?.secure) {
    segments.push('Secure')
  }

  if (options?.sameSite) {
    segments.push(`SameSite=${options.sameSite}`)
  }

  return segments.join('; ')
}
