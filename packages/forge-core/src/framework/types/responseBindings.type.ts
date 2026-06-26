import type { CookieOptions } from './response.type'

export interface ResponseBindings {
  setHeader(name: string, value: string): void
  setCookie(name: string, value: string, options?: CookieOptions): void
}

export const NO_OP_RESPONSE_BINDINGS: ResponseBindings = {
  setHeader(_name, _value) {
    /* no-op */
  },
  setCookie(_name, _value, _options) {
    /* no-op */
  },
}
