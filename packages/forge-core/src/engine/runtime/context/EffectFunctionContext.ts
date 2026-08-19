import { AnswerHistory, HookType } from '../../contracts/runtime/answerHistory.type'
import type { CookieOptions } from '../../../framework/types/response.type'
import type { ResponseBindings } from '../../../framework/types/responseBindings.type'
import type { RuntimeContext } from '../../contracts/runtime/evaluationState.type'
import { assertSerializable } from '../../../shared/utils/asserts'

function assertStringParam(value: unknown, method: string, param: string): void {
  if (typeof value !== 'string') {
    throw new TypeError(`${method}: ${param} must be a string, got ${typeof value}`)
  }
}

/**
 * User-friendly context object provided to effect functions.
 * Wraps the request/evaluation state with a cleaner API.
 *
 * Provides access to:
 * - Answers (get, set, check, clear) with mutation history tracking
 * - Data (get, set)
 * - Request data (params, query, post, session, state)
 * - Response mutations (headers, cookies)
 *
 * The hookType parameter determines the source recorded when setting answers.
 *
 * @typeParam TData - Type for stored data (accessed via getData/setData)
 * @typeParam TAnswers - Type for form answers (accessed via getAnswer/setAnswer)
 * @typeParam TSession - Type for session object (accessed via getSession)
 * @typeParam TState - Type for request state (accessed via getState)
 *
 * @example
 * // Define your project/journey schemas
 * interface MyData {
 *   assessmentUuid: string
 *   goals: Goal[]
 * }
 *
 * interface MyAnswers {
 *   goalDescription: string
 *   targetDate: string
 * }
 *
 * interface MySession {
 *   user: User
 *   stepsCompleted: string[]
 * }
 *
 * // Create a typed context alias
 * type MyContext = EffectFunctionContext<MyData, MyAnswers, MySession>
 *
 * // Use in effects
 * const myEffect = (context: MyContext) => {
 *   context.getData('assessmentUuid')  // typed as string
 *   context.getData('nonExistent')     // compile error
 * }
 */
class EffectFunctionContext<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TAnswers extends Record<string, unknown> = Record<string, unknown>,
  TSession = unknown,
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  /** @internal */
  constructor(
    private readonly context: RuntimeContext,
    private readonly response: ResponseBindings,
    private readonly hookType: HookType,
  ) {}

  /**
   * Get a specific answer value by key
   */
  getAnswer<K extends string & keyof TAnswers>(key: K): TAnswers[K]

  getAnswer<TValue = unknown>(key: string): TValue

  getAnswer<TValue = unknown>(key: string): TValue {
    return this.context.domain.answers[key]?.current as TValue
  }

  /**
   * Set a specific answer value
   *
   * Pushes a mutation to the answer's history with the current hookType as source.
   * This enables precedence logic and delta tracking via mutation history.
   */
  setAnswer<K extends string & keyof TAnswers>(key: K, value: TAnswers[K]): void {
    assertSerializable(value, 'setAnswer', [key])

    const history = this.context.domain.answers[key] ?? { current: undefined, mutations: [] }

    history.mutations.push({ value, source: this.hookType })
    history.current = value
    this.context.domain.answers[key] = history
  }

  /**
   * Get all answers (current values only, without history)
   */
  getAllAnswers(): TAnswers {
    const result: Record<string, unknown> = {}

    Object.entries(this.context.domain.answers).forEach(([key, history]) => {
      result[key] = history.current
    })

    return result as TAnswers
  }

  /**
   * Get the full history for an answer
   *
   * Returns the complete mutation history including all sources that have set this answer.
   */
  getAnswerHistory<K extends string & keyof TAnswers>(key: K): AnswerHistory | undefined {
    return this.context.domain.answers[key]
  }

  /**
   * Get all answer histories
   *
   * Returns all answers with their full mutation history.
   * Useful for calculating custom deltas based on mutation sources.
   */
  getAllAnswerHistories(): Record<string, AnswerHistory> {
    return this.context.domain.answers
  }

  /**
   * Check if an answer exists
   */
  hasAnswer<K extends string & keyof TAnswers>(key: K): boolean {
    return key in this.context.domain.answers
  }

  /**
   * Remove a specific answer
   */
  clearAnswer<K extends string & keyof TAnswers>(key: K): void {
    delete this.context.domain.answers[key]
  }

  /**
   * Get stored data by key
   */
  getData<K extends string & keyof TData>(key: K): TData[K]

  getData<TValue = unknown>(key: string): TValue

  getData<TValue = unknown>(key: string): TValue {
    return this.context.domain.data[key] as TValue
  }

  /**
   * Store data in the context
   */
  setData<K extends string & keyof TData>(key: K, value: TData[K]): void {
    assertSerializable(value, 'setData', [key])

    this.context.domain.data[key] = value
  }

  /**
   * Get all stored data
   */
  getAllData(): TData {
    return { ...this.context.domain.data } as TData
  }

  /**
   * Get the full request URL
   *
   * @example
   * const url = new URL(ctx.getRequestUrl())
   *
   * url.origin      // 'https://example.com:3000'
   * url.pathname    // '/forms/journey/step-one'
   * url.search      // '?page=1&filter=active'
   * url.searchParams.get('page')  // '1'
   * url.hash        // '#section'
   */
  getRequestUrl(): string {
    return this.context.request.url
  }

  /**
   * Get a specific route parameter
   */
  getRequestParam(key: string): string | undefined {
    return this.context.request.params[key]
  }

  /**
   * Get all route parameters
   */
  getAllRequestParams(): Record<string, string> {
    return { ...this.context.request.params }
  }

  /**
   * Get a specific query parameter
   */
  getQueryParam(key: string): string | string[] | undefined {
    return this.context.request.query[key]
  }

  /**
   * Get all query parameters
   */
  getAllQueryParams(): Record<string, string | string[]> {
    return { ...this.context.request.query }
  }

  /**
   * Get raw POST data (before formatting)
   */
  getPostData<TValue = unknown>(key: string): TValue | undefined {
    return this.context.request.post[key] as TValue | undefined
  }

  /**
   * Get all raw POST data (before formatting)
   */
  getAllPostData<TValue = Record<string, unknown>>(): TValue {
    return { ...this.context.request.post } as TValue
  }

  /**
   * Get the session object
   */
  getSession(): TSession | undefined {
    return this.context.request.session as TSession | undefined
  }

  /**
   * Get a custom request state value by key
   */
  getState<K extends string & keyof TState>(key: K): TState[K] | undefined {
    return this.context.request.state[key] as TState[K] | undefined
  }

  /**
   * Get all custom request state data
   */
  getAllState(): TState {
    return { ...this.context.request.state } as TState
  }

  /**
   * Get a request header value
   */
  getRequestHeader(name: string): string | string[] | undefined {
    return this.context.request.headers[name]
  }

  /**
   * Get all request headers
   */
  getAllRequestHeaders(): Record<string, string | string[] | undefined> {
    return { ...this.context.request.headers }
  }

  /**
   * Get a request cookie value
   */
  getRequestCookie(name: string): string | undefined {
    return this.context.request.cookies[name]
  }

  /**
   * Get all request cookies
   */
  getAllRequestCookies(): Record<string, string | undefined> {
    return { ...this.context.request.cookies }
  }

  /**
   * Set a response header via the adapter-provided response bindings.
   * Setting the same header multiple times will overwrite the previous value.
   */
  setResponseHeader(name: string, value: string): void {
    assertStringParam(name, 'setResponseHeader', 'name')
    assertStringParam(value, 'setResponseHeader', 'value')

    this.response.setHeader(name, value)
  }

  /**
   * Set a cookie via the adapter-provided response bindings.
   * To clear a cookie, use maxAge: 0.
   *
   * @example
   * // Set a cookie with options
   * context.setResponseCookie('preference', 'dark', {
   *   maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
   *   httpOnly: true,
   *   secure: true,
   *   sameSite: 'lax',
   * })
   *
   * // Clear a cookie
   * context.setResponseCookie('preference', '', { maxAge: 0 })
   */
  setResponseCookie(name: string, value: string, options?: CookieOptions): void {
    assertStringParam(name, 'setResponseCookie', 'name')
    assertStringParam(value, 'setResponseCookie', 'value')

    this.response.setCookie(name, value, options)
  }

  /**
   * Get the field codes the answer-cleardown phase resolved as stale: field codes on
   * unreachable steps plus answer keys matching their `cleardownFieldCodes` patterns.
   * The engine has already pushed a clearing `cleardown` mutation onto each of these
   * answers; use this list to drop them from your own store when persisting. Empty for
   * hooks that run before the cleardown phase (access hooks).
   */
  getFieldsToClear(): string[] {
    return [...(this.context.evaluation.fieldsToClear ?? [])]
  }
}

export default EffectFunctionContext
export { EffectFunctionContext }
