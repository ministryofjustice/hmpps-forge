/**
 * Hook types that can set answers.
 */
export type HookType = 'access' | 'submit'

/**
 * Sources that can provide answer values.
 */
export type AnswerSource = HookType | 'post' | 'processed' | 'default' | 'dependentWhen' | 'cleardown'

/**
 * A single answer mutation recorded by compiled answer prep and hook code.
 */
export interface AnswerMutation {
  readonly value: unknown
  readonly source: AnswerSource
}

/**
 * History of mutations to an answer over the request lifecycle.
 */
export interface AnswerHistory {
  current: unknown
  parsed?: unknown
  mutations: AnswerMutation[]
}
