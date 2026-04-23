/**
 * Hook types that can set answers.
 */
export type HookType = 'access' | 'action' | 'submit'

/**
 * Sources that can provide answer values.
 */
export type AnswerSource = HookType | 'post' | 'processed' | 'default' | 'dependentWhen'

/**
 * A single answer mutation recorded by compiled answer prep and hook code.
 */
export interface AnswerMutation {
  value: unknown
  source: AnswerSource
}

/**
 * History of mutations to an answer over the request lifecycle.
 */
export interface AnswerHistory {
  current: unknown
  mutations: AnswerMutation[]
}
