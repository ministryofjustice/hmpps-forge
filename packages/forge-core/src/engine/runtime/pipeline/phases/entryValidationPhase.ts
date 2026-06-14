import type { EntryValidationPlan, ValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { NodeId } from '../../../contracts/ast/engine.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import { buildCompiledBaseContext } from '../../context/compiledEvaluationContext'
import { evaluateEntryValidation } from './evaluateEntryValidation'
import { evaluateValidation } from './evaluateValidation'
import type { RequestPhase } from '../types'

/**
 * Builds the entry-validation phase for a GET step: evaluates the step's entry
 * rules to select which validation groups apply on entry, then runs validation
 * for just those groups. Always yields `{ action: 'continue' }` — entry validation
 * surfaces failures for display rather than halting the request. Whenever any group is
 * selected it records the verdict on `state.validation`, stamps
 * `context.global.validation` so compiled code can read the prior verdict, and sets
 * `state.showValidationFailures` so the render phase reveals any failures.
 * Short-circuits with `continue` when no rule selects any group (an empty plan
 * selects none), leaving `state` untouched.
 */
export function createEntryValidationPhase(
  entryValidationPlan: EntryValidationPlan,
  validationPlan: ValidationPlan,
  stepNodeId: NodeId,
  functionRegistry: FunctionRegistry,
): RequestPhase {
  return {
    name: 'entry-validation',
    async execute(state) {
      const ctx = buildCompiledBaseContext(state.context, functionRegistry, state.trace)
      const groups = await evaluateEntryValidation(entryValidationPlan, ctx, state.trace)

      if (groups.length === 0) {
        return { action: 'continue' }
      }

      const result = await evaluateValidation(validationPlan, ctx, { isSubmission: false, groups }, state.trace)

      state.context.global.validation = {
        stepNodeId,
        validated: true,
        groups,
        isSubmission: false,
        isValid: result.isValid,
        fieldFailures: result.fieldFailures,
        domainFailures: result.domainFailures,
      }
      state.validation = result
      state.showValidationFailures = true

      return { action: 'continue' }
    },
  }
}
