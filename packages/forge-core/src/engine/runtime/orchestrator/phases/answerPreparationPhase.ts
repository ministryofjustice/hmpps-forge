import type { AnswerPreparationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import { evaluateAnswerPreparation } from './evaluateAnswerPreparation'
import type { RequestPhase } from '../types'

/**
 * Builds the `answer-preparation` request phase. On execute it runs the compiled
 * answer-preparation plan, which mutates `state.context` answers in place
 * (formatting each field's submitted or default answer), then always returns
 * `{ action: 'continue' }` so the pipeline proceeds to the next phase.
 */
export function createAnswerPreparationPhase(
  answerPreparationPlan: AnswerPreparationPlan,
  functionRegistry: FunctionRegistry,
): RequestPhase {
  return {
    name: 'answer-preparation',
    async execute(state) {
      await evaluateAnswerPreparation(answerPreparationPlan, state.context, functionRegistry, state.trace)

      return { action: 'continue' }
    },
  }
}
