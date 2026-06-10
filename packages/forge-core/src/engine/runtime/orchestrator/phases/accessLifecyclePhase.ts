import createHttpError from 'http-errors'
import type { AccessLifecyclePlan } from '../../../contracts/plans/compilationArtefacts.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import { buildCompiledHookLifecycleContext } from '../../context/compiledEvaluationContext'
import { evaluateAccessLifecycle } from './evaluateAccessLifecycle'
import type { RequestPhase } from '../types'

/**
 * Builds the access-lifecycle phase: runs the compiled access hooks and maps
 * their combined result onto a PhaseOutcome. A `'redirect'` outcome halts with
 * the hook's target (throwing a 500 if the target is absent), an `'error'`
 * outcome halts with its status/message (defaulting to 500 / 'Access denied'),
 * and anything else continues. An empty plan (no access hooks) trivially
 * continues.
 */
export function createAccessLifecyclePhase(
  accessLifecyclePlan: AccessLifecyclePlan,
  functionRegistry: FunctionRegistry,
): RequestPhase {
  return {
    name: 'access-lifecycle',
    async execute(state) {
      const result = await evaluateAccessLifecycle(
        accessLifecyclePlan,
        buildCompiledHookLifecycleContext(state.context, functionRegistry, 'access', state.responseBindings),
        state.trace,
      )

      if (result.outcome === 'redirect') {
        if (result.redirect === undefined) {
          throw createHttpError(500, 'Hook redirect target is missing')
        }

        return { action: 'halt-redirect', target: result.redirect, reason: 'access-lifecycle' }
      }

      if (result.outcome === 'error') {
        return { action: 'halt-error', status: result.status ?? 500, message: result.message || 'Access denied' }
      }

      return { action: 'continue' }
    },
  }
}
