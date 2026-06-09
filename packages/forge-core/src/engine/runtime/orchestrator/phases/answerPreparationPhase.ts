import type { AnswerPreparationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import { evaluateAnswerPreparation } from './evaluateAnswerPreparation'
import type { RequestPhase } from '../types'

export function createAnswerPreparationPlanPhase(
  answerPreparationPlan: AnswerPreparationPlan,
  functionRegistry: FunctionRegistry,
): RequestPhase {
  return {
    name: 'prepare-answers',
    async execute(state) {
      await evaluateAnswerPreparation(answerPreparationPlan, state.context, functionRegistry)

      return { action: 'continue' }
    },
  }
}
