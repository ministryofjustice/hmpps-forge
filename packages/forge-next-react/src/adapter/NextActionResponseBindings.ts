import type { CookieOptions, ResponseBindings } from '@ministryofjustice/hmpps-forge/core/framework'

export interface NextCookieSetOptions {
  maxAge?: number
  expires?: Date
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  path?: string
  domain?: string
}

export interface NextCookieStore {
  set(name: string, value: string, options?: NextCookieSetOptions): void
}

/**
 * Bridges engine cookie mutations to the cookie store resolved from Next's
 * `cookies()` inside a server action. Headers cannot be set from a server
 * action, so {@link setHeader} is a no-op.
 */
export default class NextActionResponseBindings implements ResponseBindings {
  constructor(private readonly cookieStore: NextCookieStore) {}

  setHeader(_name: string, _value: string): void {
    // Server actions have no API to set response headers; the mutation is dropped.
  }

  setCookie(name: string, value: string, options?: CookieOptions): void {
    this.cookieStore.set(name, value, this.toNextCookieOptions(options))
  }

  private toNextCookieOptions(options?: CookieOptions): NextCookieSetOptions | undefined {
    if (options === undefined) {
      return undefined
    }

    return {
      // Core expresses cookie lifetimes in milliseconds; Next expects seconds.
      maxAge: options.maxAge === undefined ? undefined : Math.floor(options.maxAge / 1000),
      expires: options.expires,
      httpOnly: options.httpOnly,
      secure: options.secure,
      sameSite: options.sameSite,
      path: options.path,
      domain: options.domain,
    }
  }
}
