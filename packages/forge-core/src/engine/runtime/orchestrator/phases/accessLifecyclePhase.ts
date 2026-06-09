import createHttpError from 'http-errors'
import type { ForgeInstrumentation } from '../../../../instrumentation/ForgeInstrumentation'
import type { AccessLifecyclePlan } from '../../../contracts/plans/compilationArtefacts.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import { buildCompiledHookLifecycleContext } from '../../context/compiledEvaluationContext'
import { evaluateAccessLifecycle } from './evaluateAccessLifecycle'
import type { RequestPhase } from '../types'

export function createAccessLifecyclePhase(
  accessLifecyclePlan: AccessLifecyclePlan | undefined,
  path: string,
  functionRegistry: FunctionRegistry,
  instrumentation: ForgeInstrumentation,
): RequestPhase {
  return {
    name: 'access-lifecycle',
    async execute(state) {
      if (!accessLifecyclePlan) {
        throw new Error(`[Forge] Access lifecycle plan is missing for "${path}"`)
      }

      const result = await evaluateAccessLifecycle(
        accessLifecyclePlan,
        buildCompiledHookLifecycleContext(
          state.context,
          functionRegistry,
          instrumentation,
          'access',
          state.responseBindings,
        ),
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
