import type { CookieMutation, CookieOptions, ResponseBindings } from '@ministryofjustice/hmpps-forge/core/framework'

/**
 * Records header and cookie mutations written by engine hooks, then replays them
 * onto a built {@link Response} via {@link applyTo}. Deterministic — it does not
 * rely on Next's implicit `cookies()` to Response merge.
 */
export default class RecordingResponseBindings implements ResponseBindings {
  private readonly headers = new Map<string, string>()

  private readonly cookies = new Map<string, CookieMutation>()

  setHeader(name: string, value: string): void {
    this.headers.set(name, value)
  }

  setCookie(name: string, value: string, options?: CookieOptions): void {
    this.cookies.set(name, { value, options })
  }

  applyTo(response: Response): Response {
    this.headers.forEach((value, name) => {
      response.headers.set(name, value)
    })

    this.cookies.forEach((cookie, name) => {
      response.headers.append(
        'set-cookie',
        RecordingResponseBindings.serializeCookie(name, cookie.value, cookie.options),
      )
    })

    return response
  }

  private static serializeCookie(name: string, value: string, options?: CookieOptions): string {
    const segments = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`]

    if (options?.maxAge !== undefined) {
      // Core expresses cookie lifetimes in milliseconds; Set-Cookie Max-Age is seconds.
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
}
