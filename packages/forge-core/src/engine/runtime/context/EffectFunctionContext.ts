import { AnswerHistory, HookType } from '../types/AnswerHistory.type'
import { JourneyReachabilityState } from '../../types/JourneyReachabilityState.type'
import type { StepRequest } from '../../../framework/types/request.type'
import type { CookieMutation, CookieOptions, StepResponse } from '../../../framework/types/response.type'
import { assertSerializable } from '../../../shared/utils/asserts'
import FieldsToClearResolver from './FieldsToClearResolver'

function assertStringParam(value: unknown, method: string, param: string): void {
  if (typeof value !== 'string') {
    throw new TypeError(`${method}: ${param} must be a string, got ${typeof value}`)
  }
}

export interface EffectEvaluationContext {
  global: {
    data: Record<string, unknown>
    answers: Record<string, AnswerHistory>
    reachability?: JourneyReachabilityState
  }
  request: StepRequest
  response: StepResponse
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
  private readonly fieldsToClearResolver = new FieldsToClearResolver()

  /** @internal */
  constructor(
    private readonly context: EffectEvaluationContext,
    private readonly hookType: HookType,
  ) {}

  /**
   * Get a specific answer value by key
   */
  getAnswer<K extends string & keyof TAnswers>(key: K): TAnswers[K] {
    return this.context.global.answers[key]?.current as TAnswers[K]
  }

  /**
   * Set a specific answer value
   *
   * Pushes a mutation to the answer's history with the current hookType as source.
   * This enables precedence logic and delta tracking via mutation history.
   */
  setAnswer<K extends string & keyof TAnswers>(key: K, value: TAnswers[K]): void {
    assertSerializable(value, 'setAnswer', [key])

    const history = this.context.global.answers[key] ?? { current: undefined, mutations: [] }

    history.mutations.push({ value, source: this.hookType })
    history.current = value
    this.context.global.answers[key] = history
  }

  /**
   * Get all answers (current values only, without history)
   */
  getAllAnswers(): TAnswers {
    const result: Record<string, unknown> = {}

    Object.entries(this.context.global.answers).forEach(([key, history]) => {
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
    return this.context.global.answers[key]
  }

  /**
   * Get all answer histories
   *
   * Returns all answers with their full mutation history.
   * Useful for calculating custom deltas based on mutation sources.
   */
  getAllAnswerHistories(): Record<string, AnswerHistory> {
    return this.context.global.answers
  }

  /**
   * Check if an answer exists
   */
  hasAnswer<K extends string & keyof TAnswers>(key: K): boolean {
    return key in this.context.global.answers
  }

  /**
   * Remove a specific answer
   */
  clearAnswer<K extends string & keyof TAnswers>(key: K): void {
    delete this.context.global.answers[key]
  }

  /**
   * Get stored data by key
   */
  getData<K extends string & keyof TData>(key: K): TData[K] {
    return this.context.global.data[key] as TData[K]
  }

  /**
   * Store data in the context
   */
  setData<K extends string & keyof TData>(key: K, value: TData[K]): void {
    assertSerializable(value, 'setData', [key])

    this.context.global.data[key] = value
  }

  /**
   * Get all stored data
   */
  getAllData(): TData {
    return { ...this.context.global.data } as TData
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
    return this.context.request.getParam(key)
  }

  /**
   * Get all route parameters
   */
  getAllRequestParams(): Record<string, string> {
    return { ...this.context.request.getParams() }
  }

  /**
   * Get a specific query parameter
   */
  getQueryParam(key: string): string | string[] | undefined {
    return this.context.request.getQuery(key)
  }

  /**
   * Get all query parameters
   */
  getAllQueryParams(): Record<string, string | string[]> {
    return { ...this.context.request.getAllQuery() }
  }

  /**
   * Get raw POST data (before formatting)
   */
  getPostData(key?: string): any | undefined {
    if (key === undefined) {
      return { ...this.context.request.getAllPost() }
    }

    return this.context.request.getPost(key)
  }

  /**
   * Get the session object
   */
  getSession(): TSession | undefined {
    return this.context.request.getSession() as TSession | undefined
  }

  /**
   * Get a custom request state value by key
   */
  getState<K extends string & keyof TState>(key: K): TState[K] | undefined {
    return this.context.request.getState(key) as TState[K] | undefined
  }

  /**
   * Get all custom request state data
   */
  getAllState(): TState {
    return { ...this.context.request.getAllState() } as TState
  }

  /**
   * Get a request header value
   */
  getRequestHeader(name: string): string | string[] | undefined {
    return this.context.request.getHeader(name)
  }

  /**
   * Get all request headers
   */
  getAllRequestHeaders(): Record<string, string | string[] | undefined> {
    return { ...this.context.request.getAllHeaders() }
  }

  /**
   * Get a request cookie value
   */
  getRequestCookie(name: string): string | undefined {
    return this.context.request.getCookie(name)
  }

  /**
   * Get all request cookies
   */
  getAllRequestCookies(): Record<string, string | undefined> {
    return { ...this.context.request.getAllCookies() }
  }

  /**
   * Set a response header
   *
   * Headers are written directly to the response via the framework adapter.
   * Setting the same header multiple times will overwrite the previous value.
   */
  setResponseHeader(name: string, value: string): void {
    assertStringParam(name, 'setResponseHeader', 'name')
    assertStringParam(value, 'setResponseHeader', 'value')

    this.context.response.setHeader(name, value)
  }

  /**
   * Get a previously set response header
   */
  getResponseHeader(name: string): string | undefined {
    return this.context.response.getHeader(name)
  }

  /**
   * Get all response headers that have been set
   */
  getAllResponseHeaders(): ReadonlyMap<string, string> {
    return this.context.response.getAllHeaders()
  }

  /**
   * Set a cookie in the response
   *
   * Cookies are written directly to the response via the framework adapter.
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

    this.context.response.setCookie(name, value, options)
  }

  /**
   * Get a previously set response cookie
   */
  getResponseCookie(name: string): CookieMutation | undefined {
    return this.context.response.getCookie(name)
  }

  /**
   * Get all response cookies that have been set
   */
  getAllResponseCookies(): ReadonlyMap<string, CookieMutation> {
    return this.context.response.getAllCookies()
  }

  /**
   * Get the field codes that should be cleared based on unreachable steps.
   *
   * Combines two sources:
   * - Field codes discovered on unreachable steps (from block definitions)
   * - Answer keys that match any `cleardownFieldCodes` patterns on unreachable steps
   *
   * Returns a deduplicated array of field codes.
   */
  getFieldsToClear(): string[] {
    return this.fieldsToClearResolver.resolve(this.context.global.reachability, this.context.global.answers)
  }
}

export default EffectFunctionContext
export { EffectFunctionContext }
