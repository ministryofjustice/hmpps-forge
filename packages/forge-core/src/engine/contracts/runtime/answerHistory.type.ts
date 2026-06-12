/**
 * Hook types that can set answers.
 */
export type HookType = 'access' | 'submit'

/**
 * Sources that can provide answer values. `cleardown` is pushed by the
 * cleardown pipeline phase when a field's step became unreachable; its value
 * is always `undefined`.
 */
export type AnswerSource = HookType | 'post' | 'processed' | 'default' | 'dependentWhen' | 'cleardown'

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
