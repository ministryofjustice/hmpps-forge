import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { AnswerHistory, TransitionType } from '@form-engine/core/ast/thunks/types'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'

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
 */
export default class EffectFunctionContext {
  constructor(
    private readonly context: ThunkEvaluationContext,
    private readonly transitionType: TransitionType,
  ) {}

  /**
   * Get a specific answer value by key
   */
  getAnswer(key: string): unknown {
    return this.context.global.answers[key]?.current
  }

  /**
   * Set a specific answer value
   *
   * Pushes a mutation to the answer's history with the current transitionType as source.
   * This enables precedence logic and delta tracking via mutation history.
   *
   * Also invalidates the cached answer pseudo nodes (ANSWER_LOCAL and ANSWER_REMOTE)
   * for this field, ensuring subsequent evaluations see the updated value rather than
   * a stale cached result.
   */
  setAnswer(key: string, value: unknown): void {
    const history = this.context.global.answers[key] ?? { current: undefined, mutations: [] }

    history.mutations.push({ value, source: this.transitionType })
    history.current = value
    this.context.global.answers[key] = history

    // Invalidate cached pseudo nodes so next access re-evaluates
    const localPseudoNode = this.context.nodeRegistry.findPseudoNode(PseudoNodeType.ANSWER_LOCAL, key)
    const remotePseudoNode = this.context.nodeRegistry.findPseudoNode(PseudoNodeType.ANSWER_REMOTE, key)

    if (localPseudoNode) {
      this.context.cacheManager.delete(localPseudoNode.id)
    }

    if (remotePseudoNode) {
      this.context.cacheManager.delete(remotePseudoNode.id)
    }
  }

  /**
   * Get all answers (current values only, without history)
   */
  getAnswers(): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    Object.entries(this.context.global.answers).forEach(([key, history]) => {
      result[key] = history.current
    })

    return result
  }

  /**
   * Get the full history for an answer
   *
   * Returns the complete mutation history including all sources that have set this answer.
   */
  getAnswerHistory(key: string): AnswerHistory | undefined {
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
  hasAnswer(key: string): boolean {
    return key in this.context.global.answers
  }

  /**
   * Remove a specific answer
   */
  clearAnswer(key: string): void {
    delete this.context.global.answers[key]
  }

  /**
   * Get stored data by key
   */
  getData(key?: string): any | undefined {
    if (key === undefined) {
      return this.context.global.data
    }

    return this.context.global.data[key]
  }

  /**
   * Store data in the context
   */
  setData(key: string, value: any): void {
    this.context.global.data[key] = value
  }

  /**
   * Get all stored data
   */
  getAllData(): Record<string, any> {
    return { ...this.context.global.data }
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
  getSession(): any | undefined {
    return this.context.request.session
  }

  /**
   * Get a custom request state value by key
   */
  getState(key: string): any | undefined {
    return this.context.request.state?.[key]
  }

  /**
   * Get all custom request state data
   */
  getAllState(): Record<string, any> {
    return this.context.request.state ? { ...this.context.request.state } : {}
  }
}
