import { headers as nextHeaders } from 'next/headers'
import { joinPaths } from '@ministryofjustice/hmpps-forge/core/framework'

import type { NextForgePageProps } from './createNextForgePage'
import type { RouteParamValue } from './types'

type SearchParamValue = string | string[] | undefined

export interface NextPageRequestOptions {
  mountPath: string
  pathParam?: string
  origin?: string
}

/**
 * Builds the synthetic {@link Request} objects the page and action flows feed
 * into Forge. Next 15/16 exposes no server-side API to read the incoming URL of
 * a server component or action, so the request is reconstructed from the route
 * props and `next/headers`.
 */
export default class NextRequestFactory {
  static async buildPageRequest(props: NextForgePageProps, options: NextPageRequestOptions): Promise<Request> {
    const [params, searchParams, headers] = await Promise.all([
      this.resolveParams(props.params),
      this.resolveSearchParams(props.searchParams),
      this.getRequestHeaders(),
    ])
    const pathname = this.createPathname(options.mountPath, params, options.pathParam ?? 'forgePath')
    const url = new URL(pathname, options.origin ?? this.inferOrigin(headers))

    this.toUrlSearchParams(searchParams).forEach((value, key) => {
      url.searchParams.append(key, value)
    })

    return new Request(url, {
      method: 'GET',
      headers,
    })
  }

  static async buildActionRequest(path: string, formData: FormData, options: { origin?: string }): Promise<Request> {
    const headers = await this.getRequestHeaders()
    const url = new URL(path, options.origin ?? this.inferOrigin(headers))

    return new Request(url, {
      method: 'POST',
      headers,
      body: formData,
    })
  }

  private static async resolveParams(params: NextForgePageProps['params']): Promise<Record<string, RouteParamValue>> {
    return params ?? {}
  }

  private static async resolveSearchParams(
    searchParams: NextForgePageProps['searchParams'],
  ): Promise<Record<string, SearchParamValue>> {
    return searchParams ?? {}
  }

  private static async getRequestHeaders(): Promise<Headers> {
    const readonlyHeaders = await nextHeaders()
    const headers = new Headers()

    readonlyHeaders.forEach((value, key) => {
      headers.set(key, value)
    })

    return headers
  }

  private static createPathname(mountPath: string, params: Record<string, RouteParamValue>, pathParam: string): string {
    const normalizedParams = this.normalizeParams(params)
    const forgePath = normalizedParams[pathParam]

    return forgePath ? joinPaths(mountPath, forgePath) : joinPaths(mountPath)
  }

  private static normalizeParams(params: Record<string, RouteParamValue>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(params)
        .map(([name, value]) => [name, Array.isArray(value) ? value.join('/') : value])
        .filter((entry): entry is [string, string] => entry[1] !== undefined),
    )
  }

  private static toUrlSearchParams(searchParams: Record<string, SearchParamValue>): URLSearchParams {
    const result = new URLSearchParams()

    Object.entries(searchParams).forEach(([key, value]) => {
      if (value === undefined) {
        return
      }

      if (Array.isArray(value)) {
        value.forEach(item => result.append(key, item))

        return
      }

      result.set(key, value)
    })

    return result
  }

  private static inferOrigin(headers: { get(_name: string): string | null }): string {
    const host =
      this.firstHeaderValue(headers.get('x-forwarded-host')) ??
      this.firstHeaderValue(headers.get('host')) ??
      'localhost'
    const protocol = this.firstHeaderValue(headers.get('x-forwarded-proto')) ?? 'http'

    return `${protocol}://${host}`
  }

  private static firstHeaderValue(value: string | null): string | undefined {
    return value?.split(',')[0]?.trim() || undefined
  }
}
