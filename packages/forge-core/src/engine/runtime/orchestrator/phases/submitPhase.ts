import createHttpError from 'http-errors'
import type { ForgeInstrumentation } from '../../../../instrumentation/ForgeInstrumentation'
import type { CompiledSubmitHooksFunction } from '../../../types/hookLifecycle.type'
import type { CompiledValidationFunction } from '../../../types/compiledPhaseResults.type'
import type { NodeId } from '../../../types/engine.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import { buildCompiledHookLifecycleContext } from '../../context/compiledEvaluationContext'
import { evaluateValidation } from './evaluateValidation'
import type { RequestPhase } from '../types'

export function createSubmitPhase(
  compiledSubmitHooks: CompiledSubmitHooksFunction | undefined,
  compiledValidation: CompiledValidationFunction | undefined,
  stepId: NodeId,
  path: string,
  functionRegistry: FunctionRegistry,
  instrumentation: ForgeInstrumentation,
): RequestPhase {
  return {
    name: 'submit-hooks',
    async execute(state) {
      if (!compiledSubmitHooks) {
        throw new Error(`[Forge] Hook fallback is disabled — compiledSubmitHooks is missing for step "${path}"`)
      }

      const result = await compiledSubmitHooks(
        buildCompiledHookLifecycleContext(state.context, functionRegistry, instrumentation, groups =>
          evaluateValidation(compiledValidation, path, stepId, state.context, functionRegistry, true, groups),
        ),
      )

      if (result.outcome === 'redirect') {
        if (result.redirect === undefined) {
          throw createHttpError(500, 'Hook redirect target is missing')
        }

        return { action: 'halt-redirect', target: result.redirect, reason: 'submit' }
      }

      if (result.outcome === 'error') {
        return { action: 'halt-error', status: result.status ?? 500, message: result.message || 'Submission error' }
      }

      state.showValidationFailures = result.validated
      state.validation = state.context.global.validation
        ? {
            isValid: state.context.global.validation.isValid,
            fieldFailures: state.context.global.validation.fieldFailures,
            domainFailures: state.context.global.validation.domainFailures,
          }
        : undefined

      return { action: 'continue' }
    },
  }
}
