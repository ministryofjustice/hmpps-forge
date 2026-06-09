import type { AnswerPreparationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import { evaluateAnswerPreparation } from './evaluateAnswerPreparation'
import type { RequestPhase } from '../types'

/**
 * Builds the `prepare-answers` request phase. On execute it runs the compiled
 * answer-preparation plan, which mutates `state.context` answers in place
 * (formatting each field's submitted or default answer), then always returns
 * `{ action: 'continue' }` so the pipeline proceeds to the next phase.
 */
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
