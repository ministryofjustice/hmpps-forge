import type { CompiledAnswerPreparationFunction } from '../../../types/compiledPhaseResults.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import { buildCompiledAnswerPreparationContext } from '../../context/compiledEvaluationContext'
import type { RequestPhase } from '../types'

export function createAnswerPreparationPhase(
  compiledAnswerPreparation: CompiledAnswerPreparationFunction | undefined,
  path: string,
  functionRegistry: FunctionRegistry,
): RequestPhase {
  return {
    name: 'prepare-answers',
    async execute(state) {
      if (!compiledAnswerPreparation) {
        throw new Error(
          `[Forge] Answer preparation compilation is required — compiledAnswerPreparation is missing for "${path}"`,
        )
      }

      await compiledAnswerPreparation(buildCompiledAnswerPreparationContext(state.context, functionRegistry))

      return { action: 'continue' }
    },
  }
}
