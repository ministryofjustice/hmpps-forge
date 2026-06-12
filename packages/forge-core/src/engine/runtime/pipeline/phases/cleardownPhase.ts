import { evaluateCleardown } from './evaluateCleardown'
import type { RequestPhase } from '../types'

/**
 * Builds the `cleardown` request phase. On execute it resolves the stale
 * answer field codes from the evaluation and reachability projection the
 * navigation phase stored, pushes a clearing `cleardown` mutation onto each
 * of those answers, and stores the resolved codes on the global state for
 * `getFieldsToClear()` readers, then always returns `{ action: 'continue' }`.
 */
export function createCleardownPhase(): RequestPhase {
  return {
    name: 'cleardown',
    async execute(state) {
      state.context.global.fieldsToClear = evaluateCleardown(
        state.context.global,
        state.navigationEvaluation,
        state.context.request.getParams(),
      )

      return { action: 'continue' }
    },
  }
}
