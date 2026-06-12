import type { SubmitLifecyclePlan, ValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { StepValidityResult } from '../../../contracts/runtime/stepValidityResult.type'
import type { NodeId } from '../../../contracts/ast/engine.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import { buildCompiledBaseContext, buildCompiledHookLifecycleContext } from '../../context/compiledEvaluationContext'
import { recordContextSnapshot } from '../trace/contextSnapshot'
import { evaluateValidation } from './evaluateValidation'
import { evaluateSubmitLifecycle } from './evaluateSubmitLifecycle'
import type { RequestPhase } from '../types'

/**
 * Builds the POST step's submit-lifecycle phase: runs the step's submit hooks,
 * wiring a `validate(groups)` callback that runs the step's ValidationPlan on
 * demand from within a hook and stamps the verdict on
 * `context.global.validation`. Branches on the first executed hook's outcome —
 * 'redirect' halts with its target (or with a 500 error if the target is
 * missing), 'error'
 * halts with its status/message (defaulting to 500), otherwise records on the
 * pipeline state whether the hook triggered validation
 * (`showValidationFailures`) and the verdict the callback returned, then
 * continues.
 */
// TODO: Probably worth revisiting what a POST to a step with no submit hooks
//  should do. With an empty plan the walk executes nothing and the request just
//  falls through to re-render; uniform with every other empty plan, but it can
//  hide an authoring mistake. The louder alternative would be to not mount the
//  POST route at all during executor assembly when a step has no hooks.
export function createSubmitLifecyclePhase(
  submitLifecyclePlan: SubmitLifecyclePlan,
  validationPlan: ValidationPlan,
  stepNodeId: NodeId,
  functionRegistry: FunctionRegistry,
): RequestPhase {
  return {
    name: 'submit-lifecycle',
    async execute(state) {
      let validationResult: StepValidityResult | undefined

      const validate = async (groups: string[]) => {
        const validation = await evaluateValidation(
          validationPlan,
          buildCompiledBaseContext(state.context, functionRegistry),
          { isSubmission: true, groups },
          state.trace,
        )

        state.context.global.validation = {
          stepNodeId,
          validated: true,
          groups,
          isSubmission: true,
          isValid: validation.isValid,
          fieldFailures: validation.fieldFailures,
          domainFailures: validation.domainFailures,
        }

        validationResult = validation

        return validation
      }

      const result = await evaluateSubmitLifecycle(
        submitLifecyclePlan,
        buildCompiledHookLifecycleContext(state.context, functionRegistry, 'submit', state.responseBindings, validate),
        state.trace,
        nodeId => recordContextSnapshot(state, `submit-hook:${nodeId}`),
      )

      if (result.outcome === 'redirect') {
        if (result.redirect === undefined) {
          return { action: 'halt-error', status: 500, message: 'Hook redirect target is missing' }
        }

        return { action: 'halt-redirect', target: result.redirect, reason: 'submit-lifecycle' }
      }

      if (result.outcome === 'error') {
        return { action: 'halt-error', status: result.status ?? 500, message: result.message || 'Submission error' }
      }

      state.showValidationFailures = result.validated
      state.validation = validationResult

      return { action: 'continue' }
    },
  }
}
