import { HttpMethod } from '../../engine/compilation/thunks/types'

/**
 * Framework-agnostic request interface.
 *
 * Provides methods for reading request data. The framework adapter implements
 * these methods to read from the native request object.
 */
export interface StepRequest {
  readonly method: HttpMethod
  readonly url: string

  getHeader(name: string): string | string[] | undefined
  getAllHeaders(): Record<string, string | string[] | undefined>
  getCookie(name: string): string | undefined
  getAllCookies(): Record<string, string | undefined>
  getParam(name: string): string | undefined
  getParams(): Record<string, string>
  getQuery(name: string): string | string[] | undefined
  getAllQuery(): Record<string, string | string[]>
  getPost(name: string): string | string[] | undefined
  getAllPost(): Record<string, string | string[]>
  getSession(): unknown
  getState(key: string): unknown
  getAllState(): Record<string, unknown>
}
