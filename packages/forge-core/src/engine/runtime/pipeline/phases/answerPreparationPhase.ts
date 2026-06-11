import type { AnswerPreparationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import { buildCompiledAnswerPreparationContext } from '../../context/compiledEvaluationContext'
import { evaluateAnswerPreparation } from './evaluateAnswerPreparation'
import type { RequestPhase } from '../types'

/**
 * Builds the `answer-preparation` request phase. On execute it builds the
 * compiled answer-preparation context from the request and runs the compiled
 * plan over it, which mutates `state.context` answers in place (formatting each
 * field's submitted or default answer), then always returns
 * `{ action: 'continue' }` so the pipeline proceeds to the next phase.
 */
export function createAnswerPreparationPhase(
  answerPreparationPlan: AnswerPreparationPlan,
  functionRegistry: FunctionRegistry,
): RequestPhase {
  return {
    name: 'answer-preparation',
    async execute(state) {
      await evaluateAnswerPreparation(
        answerPreparationPlan,
        buildCompiledAnswerPreparationContext(state.context, functionRegistry),
        state.trace,
      )

      return { action: 'continue' }
    },
  }
}
