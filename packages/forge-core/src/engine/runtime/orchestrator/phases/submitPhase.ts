import createHttpError from 'http-errors'
import type { ForgeInstrumentation } from '../../../../instrumentation/ForgeInstrumentation'
import type { SubmitLifecyclePlan, ValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { NodeId } from '../../../contracts/ast/engine.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import { buildCompiledHookLifecycleContext } from '../../context/compiledEvaluationContext'
import { evaluateValidation } from './evaluateValidation'
import { evaluateSubmitLifecycle } from './evaluateSubmitLifecycle'
import type { RequestPhase } from '../types'

export function createSubmitPhase(
  submitLifecyclePlan: SubmitLifecyclePlan | undefined,
  validationPlan: ValidationPlan | undefined,
  stepId: NodeId,
  path: string,
  functionRegistry: FunctionRegistry,
  instrumentation: ForgeInstrumentation,
): RequestPhase {
  return {
    name: 'submit-hooks',
    async execute(state) {
      if (!submitLifecyclePlan) {
        throw new Error(`[Forge] Submit lifecycle plan is missing for step "${path}"`)
      }

      const result = await evaluateSubmitLifecycle(
        submitLifecyclePlan,
        buildCompiledHookLifecycleContext(
          state.context,
          functionRegistry,
          instrumentation,
          'submit',
          state.responseBindings,
          groups =>
            evaluateValidation(
              validationPlan,
              path,
              stepId,
              state.context,
              functionRegistry,
              true,
              groups,
              instrumentation,
            ),
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
