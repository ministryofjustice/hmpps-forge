import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'

/**
 * User-friendly context object provided to effect functions.
 * Wraps the low-level ThunkEvaluationContext with a cleaner API.
 */
export default class EffectFunctionContext {
  constructor(private readonly context: ThunkEvaluationContext) {}

  /**
   * Get a specific answer value by key
   */
  getAnswer(key: string): any | undefined {
    return this.context.global.answers[key]
  }

  /**
   * Set a specific answer value
   */
  setAnswer(key: string, value: any): void {
    this.context.global.answers[key] = value
  }

  /**
   * Get all answers
   */
  getAnswers(): Record<string, any> {
    return { ...this.context.global.answers }
  }

  /**
   * Replace all answers
   */
  setAnswers(answers: Record<string, any>): void {
    Object.keys(this.context.global.answers).forEach(key => {
      delete this.context.global.answers[key]
    })

    Object.assign(this.context.global.answers, answers)
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
