import type { CookieMutation, CookieOptions, StepResponse } from '../../../framework/types/response.type'
import type { ForgeEffects } from '../../../framework/types/outcome.type'

/**
 * Captures response side-effects (headers, cookies) in memory during
 * evaluation instead of writing them through to a live response. After
 * evaluation the recorded effects are handed to the adapter via the
 * {@link ForgeOutcome} for it to flush however its framework requires.
 *
 * Read-after-set within a request works (an effect can read a cookie an
 * earlier effect set), so this fully replaces the previous live write-through.
 */
export default class RecordingStepResponse implements StepResponse {
  private readonly headers = new Map<string, string>()

  private readonly cookies = new Map<string, CookieMutation>()

  setHeader(name: string, value: string): void {
    this.headers.set(name, value)
  }

  getHeader(name: string): string | undefined {
    return this.headers.get(name)
  }

  getAllHeaders(): Map<string, string> {
    return this.headers
  }

  setCookie(name: string, value: string, options?: CookieOptions): void {
    this.cookies.set(name, { value, options })
  }

  getCookie(name: string): CookieMutation | undefined {
    return this.cookies.get(name)
  }

  getAllCookies(): Map<string, CookieMutation> {
    return this.cookies
  }

  toEffects(): ForgeEffects {
    return { headers: this.headers, cookies: this.cookies }
  }
}
