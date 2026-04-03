/**
 * Options for setting a cookie.
 */
export interface CookieOptions {
  maxAge?: number
  expires?: Date
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  path?: string
  domain?: string
}

/**
 * A cookie value with its options.
 */
export interface CookieMutation {
  value: string
  options?: CookieOptions
}

/**
 * Framework-agnostic response interface.
 */
export interface StepResponse {
  setHeader(name: string, value: string): void
  getHeader(name: string): string | undefined
  getAllHeaders(): Map<string, string>
  setCookie(name: string, value: string, options?: CookieOptions): void
  getCookie(name: string): CookieMutation | undefined
  getAllCookies(): Map<string, CookieMutation>
}
