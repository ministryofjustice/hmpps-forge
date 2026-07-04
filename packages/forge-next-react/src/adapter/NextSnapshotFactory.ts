import type {
  ForgeRoute,
  HttpMethod,
  RequestLocation,
  RequestSnapshot,
} from '@ministryofjustice/hmpps-forge/core/framework'
import { resolvePathParams } from '@ministryofjustice/hmpps-forge/core/framework'

import type { NextRouteContext, RouteParamValue } from './types'

export interface NextSnapshotInput {
  route: ForgeRoute
  method: HttpMethod
  request: Request
  params: Record<string, string>
  session: unknown
  state: Record<string, unknown>
  context?: NextRouteContext
}

export default class NextSnapshotFactory {
  static async create(input: NextSnapshotInput): Promise<RequestSnapshot> {
    const { route, method, request, params, session, state, context } = input
    const url = new URL(request.url)
    const nextParams = await this.resolveNextParams(context)
    const mergedParams = { ...this.normalizeParams(nextParams), ...params }
    const location = this.createRequestLocation(route, url, mergedParams)

    return {
      nodeId: route.nodeId,
      method,
      location,
      params: mergedParams,
      query: this.normalizeQuery(url.searchParams),
      post: method === 'POST' ? await this.normalizePost(request) : {},
      headers: this.normalizeHeaders(request.headers),
      cookies: this.normalizeCookies(request.headers.get('cookie')),
      state,
      session,
    }
  }

  private static createRequestLocation(route: ForgeRoute, url: URL, params: Record<string, string>): RequestLocation {
    return {
      origin: url.origin,
      href: url.href,
      pathname: url.pathname,
      basePath: resolvePathParams(route.basePath, params),
    }
  }

  private static async resolveNextParams(context?: NextRouteContext): Promise<Record<string, RouteParamValue>> {
    if (context?.params === undefined) {
      return {}
    }

    return context.params
  }

  private static normalizeParams(params: Record<string, RouteParamValue>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(params)
        .map(([name, value]) => [name, Array.isArray(value) ? value.join('/') : value])
        .filter((entry): entry is [string, string] => entry[1] !== undefined),
    )
  }

  private static normalizeQuery(searchParams: URLSearchParams): Record<string, string | string[]> {
    const query: Record<string, string | string[]> = {}

    searchParams.forEach((value, key) => {
      query[key] = this.appendRecordValue(query[key], value)
    })

    return query
  }

  private static async normalizePost(request: Request): Promise<Record<string, string | string[]>> {
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

      post[key] = this.appendRecordValue(post[key], value)
    })

    return post
  }

  private static normalizeHeaders(headers: Headers): Record<string, string | undefined> {
    const record: Record<string, string | undefined> = {}

    headers.forEach((value, key) => {
      record[key.toLowerCase()] = value
    })

    return record
  }

  private static normalizeCookies(header: string | null): Record<string, string | undefined> {
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

  private static appendRecordValue(current: string | string[] | undefined, value: string): string | string[] {
    if (current === undefined) {
      return value
    }

    return Array.isArray(current) ? [...current, value] : [current, value]
  }
}
