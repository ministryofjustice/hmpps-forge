import type { CookieMutation, CookieOptions } from './response.type'

export interface ResponseBindings {
  setHeader(name: string, value: string): void
  getHeader(name: string): string | undefined
  getAllHeaders(): ReadonlyMap<string, string>
  setCookie(name: string, value: string, options?: CookieOptions): void
  getCookie(name: string): CookieMutation | undefined
  getAllCookies(): ReadonlyMap<string, CookieMutation>
}

export const NO_OP_RESPONSE_BINDINGS: ResponseBindings = {
  setHeader(_name, _value) {
    /* no-op */
  },
  getHeader() {
    return undefined
  },
  getAllHeaders() {
    return new Map()
  },
  setCookie(_name, _value, _options) {
    /* no-op */
  },
  getCookie() {
    return undefined
  },
  getAllCookies() {
    return new Map()
  },
}
