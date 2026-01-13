import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { AnswerHistory, TransitionType } from '@form-engine/core/compilation/thunks/types'
import { getPseudoNodeKey } from '@form-engine/core/utils/pseudoNodeKeyExtractor'
import {
  AnswerLocalPseudoNode,
  AnswerRemotePseudoNode,
  DataPseudoNode,
  PseudoNodeType,
} from '@form-engine/core/types/pseudoNodes.type'

/**
 * User-friendly context object provided to effect functions.
 * Wraps the low-level ThunkEvaluationContext with a cleaner API.
 *
 * Provides access to:
 * - Answers (get, set, check, clear) with mutation history tracking
 * - Data (get, set)
 * - Request data (params, query, post, session, state)
 *
 * The transitionType parameter determines the source recorded when setting answers.
 * This enables precedence logic: action-set answers are protected from POST override.
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
export default class EffectFunctionContext<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TAnswers extends Record<string, unknown> = Record<string, unknown>,
  TSession = unknown,
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  constructor(
    private readonly context: ThunkEvaluationContext,
    private readonly transitionType: TransitionType,
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
   * Pushes a mutation to the answer's history with the current transitionType as source.
   * This enables precedence logic and delta tracking via mutation history.
   *
   * Also invalidates the cached answer pseudo nodes (ANSWER_LOCAL and ANSWER_REMOTE)
   * for this field and all dependent nodes, ensuring subsequent evaluations see the
   * updated value rather than a stale cached result.
   */
  setAnswer<K extends string & keyof TAnswers>(key: K, value: TAnswers[K]): void {
    const history = this.context.global.answers[key] ?? { current: undefined, mutations: [] }

    history.mutations.push({ value, source: this.transitionType })
    history.current = value
    this.context.global.answers[key] = history

    // Invalidate cached pseudo nodes and dependents so next access re-evaluates
    const localPseudoNode = this.context.nodeRegistry.findByType<AnswerLocalPseudoNode>(PseudoNodeType.ANSWER_LOCAL)
      .find(node => getPseudoNodeKey(node) === key)
    const remotePseudoNode = this.context.nodeRegistry.findByType<AnswerRemotePseudoNode>(PseudoNodeType.ANSWER_REMOTE)
      .find(node => getPseudoNodeKey(node) === key)

    if (localPseudoNode) {
      this.context.cacheManager.invalidateCascading(localPseudoNode.id, this.context.dependencyGraph)
    }

    if (remotePseudoNode) {
      this.context.cacheManager.invalidateCascading(remotePseudoNode.id, this.context.dependencyGraph)
    }
  }

  /**
   * Get all answers (current values only, without history)
   */
  getAnswers(): TAnswers {
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
   *
   * Also invalidates cached DATA pseudo nodes for this key and all dependent nodes,
   * ensuring subsequent evaluations see the updated value rather than a stale cached result.
   */
  setData<K extends string & keyof TData>(key: K, value: TData[K]): void {
    this.context.global.data[key] = value

    // Invalidate cached pseudo node and dependents so next access re-evaluates
    const dataPseudoNode = this.context.nodeRegistry.findByType<DataPseudoNode>(PseudoNodeType.DATA)
      .find(node => getPseudoNodeKey(node) === key)

    if (dataPseudoNode) {
      this.context.cacheManager.invalidateCascading(dataPseudoNode.id, this.context.dependencyGraph)
    }
  }

  /**
   * Get all stored data
   */
  getAllData(): TData {
    return { ...this.context.global.data } as TData
  }

  /**
   * Get a specific route parameter
   */
  getRequestParam(key: string): string | undefined {
    return this.context.request.params?.[key]
  }

  /**
   * Get all route parameters
   */
  getRequestParams(): Record<string, string> {
    return this.context.request.params ? { ...this.context.request.params } : {}
  }

  /**
   * Get a specific query parameter
   */
  getQueryParam(key: string): string | string[] | undefined {
    return this.context.request.query?.[key]
  }

  /**
   * Get all query parameters
   */
  getQueryParams(): Record<string, string | string[]> {
    return this.context.request.query ? { ...this.context.request.query } : {}
  }

  /**
   * Get raw POST data (before formatting)
   */
  getPostData(key?: string): any | undefined {
    if (!this.context.request.post) {
      return undefined
    }

    if (key === undefined) {
      return { ...this.context.request.post }
    }

    return this.context.request.post[key]
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
    return this.context.request.state?.[key] as TState[K] | undefined
  }

  /**
   * Get all custom request state data
   */
  getAllState(): TState {
    return (this.context.request.state ? { ...this.context.request.state } : {}) as TState
  }
}
