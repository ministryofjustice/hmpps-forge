import type { EntryValidationPlan, ValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { NodeId } from '../../../contracts/ast/engine.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type { ForgeInstrumentation } from '../../../../instrumentation/ForgeInstrumentation'
import { buildCompiledBaseContext } from '../../context/compiledEvaluationContext'
import { evaluateEntryValidation } from './evaluateEntryValidation'
import { evaluateValidation } from './evaluateValidation'
import type { RequestPhase } from '../types'

export function createEntryValidationPhase(
  entryValidationPlan: EntryValidationPlan | undefined,
  validationPlan: ValidationPlan | undefined,
  stepId: NodeId,
  path: string,
  functionRegistry: FunctionRegistry,
  instrumentation: ForgeInstrumentation,
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
        instrumentation,
      )
      state.showValidationFailures = true

      return { action: 'continue' }
    },
  }
}
