import createHttpError from 'http-errors'
import type { SubmitLifecyclePlan, ValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { NodeId } from '../../../contracts/ast/engine.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import { buildCompiledBaseContext, buildCompiledHookLifecycleContext } from '../../context/compiledEvaluationContext'
import { evaluateValidation } from './evaluateValidation'
import { evaluateSubmitLifecycle } from './evaluateSubmitLifecycle'
import type { RequestPhase } from '../types'

/**
 * Builds the POST step's submit-lifecycle phase: runs the step's submit hooks,
 * wiring a `validate(groups)` callback that runs the step's ValidationPlan on
 * demand from within a hook and stamps the verdict on
 * `context.global.validation`. Branches on the first executed hook's outcome —
 * 'redirect' halts with its target (500 if the target is missing), 'error'
 * halts with its status/message (defaulting to 500), otherwise records on the
 * pipeline state whether the hook triggered validation
 * (`showValidationFailures`) and the stamped verdict, then continues. Throws
 * when the submit lifecycle plan is missing, or when a hook validates without a
 * validation plan.
 */
export function createSubmitLifecyclePhase(
  submitLifecyclePlan: SubmitLifecyclePlan | undefined,
  validationPlan: ValidationPlan | undefined,
  stepId: NodeId,
  path: string,
  functionRegistry: FunctionRegistry,
): RequestPhase {
  return {
    name: 'submit-lifecycle',
    async execute(state) {
      if (!submitLifecyclePlan) {
        throw new Error(`[Forge] Submit lifecycle plan is missing for step "${path}"`)
      }

      const validate = async (groups: string[]) => {
        if (!validationPlan) {
          throw new Error(`[Forge] Validation plan is missing for step "${path}"`)
        }

        const validation = await evaluateValidation(
          validationPlan,
          buildCompiledBaseContext(state.context, functionRegistry),
          { isSubmission: true, groups },
          state.trace,
        )

        state.context.global.validation = {
          stepId,
          validated: true,
          groups,
          isSubmission: true,
          isValid: validation.isValid,
          fieldFailures: validation.fieldFailures,
          domainFailures: validation.domainFailures,
        }

        return validation
      }

      const result = await evaluateSubmitLifecycle(
        submitLifecyclePlan,
        buildCompiledHookLifecycleContext(state.context, functionRegistry, 'submit', state.responseBindings, validate),
        state.trace,
      )

      if (result.outcome === 'redirect') {
        if (result.redirect === undefined) {
          throw createHttpError(500, 'Hook redirect target is missing')
        }

        return { action: 'halt-redirect', target: result.redirect, reason: 'submit-lifecycle' }
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
