import type {
  CompiledEntryValidationFunction,
  CompiledValidationFunction,
} from '../../../contracts/compiled/compiledFunctions.type'
import type { NodeId } from '../../../contracts/ast/engine.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type { ForgeInstrumentation } from '../../../../instrumentation/ForgeInstrumentation'
import { buildCompiledBaseContext } from '../../context/compiledEvaluationContext'
import { evaluateValidation } from './evaluateValidation'
import type { RequestPhase } from '../types'

export function createEntryValidationPhase(
  compiledEntryValidation: CompiledEntryValidationFunction | undefined,
  compiledValidation: CompiledValidationFunction | undefined,
  stepId: NodeId,
  path: string,
  functionRegistry: FunctionRegistry,
  instrumentation: ForgeInstrumentation,
): RequestPhase {
  return {
    name: 'entry-validation',
    async execute(state) {
      if (!compiledEntryValidation) {
        return { action: 'continue' }
      }

      const groups = await compiledEntryValidation(buildCompiledBaseContext(state.context, functionRegistry))

      if (groups.length === 0) {
        return { action: 'continue' }
      }

      state.validation = await evaluateValidation(
        compiledValidation,
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
