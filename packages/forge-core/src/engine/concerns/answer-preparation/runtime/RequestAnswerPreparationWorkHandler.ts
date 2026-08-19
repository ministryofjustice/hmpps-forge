import ForgeInternalError from '../../../errors/ForgeInternalError'
import { buildCompiledAnswerPreparationContext } from '../../../runtime/context/compiledEvaluationContext'
import { ANSWER_PREPARATION_KIND } from './AnswerPreparationWorkHandler'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/work/work.type'
import { createWorkTask, isWorkTaskOfKind, singleTaskGroup } from '../../../work/workTask'
import { phaseInstrumentation } from '../../../runtime/pipeline/contextSnapshot'
import type { RequestAnswerPreparationWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type RequestState from '../../../runtime/pipeline/RequestState'
import type { PhaseWorkOutput } from '../../../contracts/runtime/requestPipelineOutput.type'

const REQUEST_ANSWER_PREPARATION_KIND = 'request.answer-preparation'

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

  async begin(ctx: WorkContextContract<RequestState, RequestAnswerPreparationWorkProps>) {
    const answerPreparationContext = buildCompiledAnswerPreparationContext(
      ctx.state.context,
      ctx.state.dependencies.functionRegistry,
      ctx.state.dependencies.componentRegistry,
    )

    const resolved = await ctx.props.compiled(answerPreparationContext)

    if (!isWorkTaskOfKind(resolved, ANSWER_PREPARATION_KIND)) {
      throw new ForgeInternalError('Compiled answer preparation returned an invalid work task')
    }

    return singleTaskGroup(resolved)
  },

  complete(
    _ctx: WorkContextContract<RequestState, RequestAnswerPreparationWorkProps>,
    _children: readonly CompletedWork[],
  ): PhaseWorkOutput {
    return { action: 'continue' }
  },
}

export function createRequestAnswerPreparationTask(props: RequestAnswerPreparationWorkProps) {
  return createWorkTask(
    'answer-preparation',
    REQUEST_ANSWER_PREPARATION_WORK_HANDLER,
    props,
    REQUEST_ANSWER_PREPARATION_WORK_INSTRUMENTATION,
  )
}
