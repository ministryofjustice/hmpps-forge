/**
 * HTTP method for the request
 */
export type HttpMethod = 'GET' | 'POST'

export interface RequestLocation {
  readonly origin: string
  readonly href: string
  readonly pathname: string
  readonly basePath: string
}
