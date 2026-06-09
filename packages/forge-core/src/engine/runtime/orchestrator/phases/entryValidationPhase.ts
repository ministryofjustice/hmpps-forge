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
 * selected it records the validation result on `state.validation` and sets
 * `state.showValidationFailures` so the render phase reveals any failures. Short-circuits
 * with `continue` when the step has no entry-validation plan or when no rule selects any
 * group, leaving `state` untouched.
 */
export function createEntryValidationPhase(
  entryValidationPlan: EntryValidationPlan | undefined,
  validationPlan: ValidationPlan | undefined,
  stepId: NodeId,
  path: string,
  functionRegistry: FunctionRegistry,
): RequestPhase {
  return {
    name: 'entry-validation',
    async execute(state) {
      if (!entryValidationPlan) {
        return { action: 'continue' }
      }

      const groups = await evaluateEntryValidation(
        entryValidationPlan,
        buildCompiledBaseContext(state.context, functionRegistry),
      )

      if (groups.length === 0) {
        return { action: 'continue' }
      }

      state.validation = await evaluateValidation(
        validationPlan,
        path,
        stepId,
        state.context,
        functionRegistry,
        false,
        groups,
      )
      state.showValidationFailures = true

      return { action: 'continue' }
    },
  }
}
