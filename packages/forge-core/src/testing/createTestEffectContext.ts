// eslint-disable-next-line max-classes-per-file
import type { CookieMutation, CookieOptions } from '../framework/types/response.type'
import type { HookType } from '../engine/contracts/runtime/answerHistory.type'
import type { ResponseBindings } from '../framework/types/responseBindings.type'
import type { RuntimeContext } from '../engine/contracts/runtime/evaluationState.type'
import { EffectFunctionContext } from '../engine/runtime/context/EffectFunctionContext'
import { extractPathname } from './extractPathname'

/**
 * In-memory seed for {@link createTestEffectContext}. Every field is optional and
 * defaults to empty; `answers` takes plain current values, not answer histories.
 */
export interface EffectContextSeed {
  answers?: Record<string, unknown>
  data?: Record<string, unknown>
  session?: Record<string, unknown>
  params?: Record<string, string>
  query?: Record<string, string | string[]>
  post?: Record<string, unknown>
  state?: Record<string, unknown>
  headers?: Record<string, string | string[]>
  cookies?: Record<string, string>
  url?: string
  hookType?: HookType
}

/**
 * Captures headers and cookies written through {@link ResponseBindings} so tests can
 * read back what an effect set — the base context can write these but not read them.
 */
class RecordingResponseBindings implements ResponseBindings {
  private readonly headers = new Map<string, string>()

  private readonly cookies = new Map<string, CookieMutation>()

  setHeader(name: string, value: string): void {
    this.headers.set(name, value)
  }

  setCookie(name: string, value: string, options?: CookieOptions): void {
    this.cookies.set(name, { value, options })
  }

  getHeaders(): Record<string, string> {
    return Object.fromEntries(this.headers)
  }

  getCookies(): Record<string, CookieMutation> {
    const entries = [...this.cookies].map(([name, mutation]): [string, CookieMutation] => [
      name,
      { value: mutation.value, options: mutation.options },
    ])

    return Object.fromEntries(entries)
  }
}

/**
 * A real {@link EffectFunctionContext} with two extra getters that expose the response
 * headers and cookies an effect wrote via `setResponseHeader`/`setResponseCookie`.
 */
export class TestEffectContext extends EffectFunctionContext {
  constructor(
    context: RuntimeContext,
    private readonly recordingResponse: RecordingResponseBindings,
    hookType: HookType,
  ) {
    super(context, recordingResponse, hookType)
  }

  getResponseHeaders(): Record<string, string> {
    return this.recordingResponse.getHeaders()
  }

  getResponseCookies(): Record<string, CookieMutation> {
    return this.recordingResponse.getCookies()
  }
}

/**
 * Build a real {@link EffectFunctionContext} over minimal in-memory state, so
 * effect-function tests can exercise the genuine context instead of hand-rolling a fake.
 *
 * @example
 * ```typescript
 * const context = createTestEffectContext({
 *   answers: { goalDescription: 'Learn TypeScript' },
 *   hookType: 'submit',
 * })
 *
 * myEffect(context)
 *
 * expect(context.getResponseHeaders()['x-audited']).toBe('true')
 * ```
 */
export function createTestEffectContext(seed: EffectContextSeed = {}): TestEffectContext {
  const url = seed.url ?? 'http://localhost/test'

  const context: RuntimeContext = {
    domain: {
      data: seed.data ?? {},
      answers: Object.fromEntries(
        Object.entries(seed.answers ?? {}).map(([key, value]) => [key, { current: value, mutations: [] }]),
      ),
    },
    evaluation: {},
    request: {
      url,
      path: extractPathname(url),
      method: 'GET',
      location: {
        origin: new URL(url).origin,
        href: url,
        pathname: extractPathname(url),
        basePath: extractPathname(url),
      },
      headers: seed.headers ?? {},
      cookies: seed.cookies ?? {},
      state: seed.state ?? {},
      params: seed.params ?? {},
      query: seed.query ?? {},
      post: seed.post ?? {},
      session: seed.session ?? {},
    },
  }

  const response = new RecordingResponseBindings()

  return new TestEffectContext(context, response, seed.hookType ?? 'access')
}
