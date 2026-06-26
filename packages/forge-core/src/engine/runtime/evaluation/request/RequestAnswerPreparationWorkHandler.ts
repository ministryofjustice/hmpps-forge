import { buildCompiledAnswerPreparationContext } from '../context/compiledEvaluationContext'
import { ANSWER_PREPARATION_KIND } from '../phases/answer-preparation/AnswerPreparationWorkHandler'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/runtime/work.type'
import { phaseInstrumentation, runTaskPhase } from './requestPhase'
import type { RequestAnswerPreparationWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type { PhaseWorkOutput, RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'

export const REQUEST_ANSWER_PREPARATION_KIND = 'request.answer-preparation'

export const REQUEST_ANSWER_PREPARATION_WORK_INSTRUMENTATION: WorkInstrumentation<
  RequestAnswerPreparationWorkProps,
  PhaseWorkOutput
> = phaseInstrumentation()

/**
 * The answer-preparation phase as work. `begin` runs the compiled answer
 * preparation task (which mutates the answer store in place); `complete`
 * always continues.
 */
export const REQUEST_ANSWER_PREPARATION_WORK_HANDLER: WorkHandler<
  'request.answer-preparation',
  RequestAnswerPreparationWorkProps
> = {
  kind: REQUEST_ANSWER_PREPARATION_KIND,

  async begin(ctx: WorkContextContract<RequestExecutionContext, RequestAnswerPreparationWorkProps>) {
    if (!ctx.props.compiled) {
      throw new Error(
        `[Forge] Answer preparation compilation is required — compiledAnswerPreparation is missing for "${ctx.props.path}"`,
      )
    }

    const answerPreparationContext = buildCompiledAnswerPreparationContext(
      ctx.request.context,
      ctx.request.functionRegistry,
    )

    return runTaskPhase(
      ctx.props.compiled(answerPreparationContext),
      ANSWER_PREPARATION_KIND,
      'Compiled answer preparation returned an invalid work task',
    )
  },

  complete(
    _ctx: WorkContextContract<RequestExecutionContext, RequestAnswerPreparationWorkProps>,
    _children: readonly CompletedWork[],
  ): PhaseWorkOutput {
    return { action: 'continue' }
  },
}
