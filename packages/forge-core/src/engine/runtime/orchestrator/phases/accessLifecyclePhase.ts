import createHttpError from 'http-errors'
import type { ForgeInstrumentation } from '../../../../instrumentation/ForgeInstrumentation'
import type { CompiledAccessLifecycleFunction } from '../../../types/hookLifecycle.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import { buildCompiledHookLifecycleContext } from '../../context/compiledEvaluationContext'
import type { RequestPhase } from '../types'

export function createAccessLifecyclePhase(
  compiledAccessLifecycle: CompiledAccessLifecycleFunction | undefined,
  path: string,
  functionRegistry: FunctionRegistry,
  instrumentation: ForgeInstrumentation,
): RequestPhase {
  return {
    name: 'access-lifecycle',
    async execute(state) {
      if (!compiledAccessLifecycle) {
        throw new Error(`[Forge] Hook fallback is disabled — compiledAccessLifecycle is missing for "${path}"`)
      }

      const result = await compiledAccessLifecycle(
        buildCompiledHookLifecycleContext(state.context, functionRegistry, instrumentation),
      )

      if (result.outcome === 'redirect') {
        if (result.redirect === undefined) {
          throw createHttpError(500, 'Hook redirect target is missing')
        }

        return { action: 'halt-redirect', target: result.redirect }
      }

      if (result.outcome === 'error') {
        return { action: 'halt-error', status: result.status ?? 500, message: result.message || 'Access denied' }
      }

      return { action: 'continue' }
    },
  }
}
