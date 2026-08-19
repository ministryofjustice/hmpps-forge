import { evaluateAnswerCleardown } from './evaluateAnswerCleardown'
import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../../chassis/contracts/work/work.type'
import { createWorkTask } from '../../../chassis/work/workTask'
import { phaseInstrumentation } from '../../../chassis/runtime/pipeline/contextSnapshot'
import type { RequestAnswerCleardownWorkProps } from '../../../chassis/contracts/runtime/RequestPipelineWork.type'
import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type { PhaseWorkOutput } from '../../../chassis/contracts/runtime/requestPipelineOutput.type'

const REQUEST_ANSWER_CLEARDOWN_KIND = 'request.answer-cleardown'

export const REQUEST_ANSWER_CLEARDOWN_WORK_INSTRUMENTATION: WorkInstrumentation<
  RequestAnswerCleardownWorkProps,
  PhaseWorkOutput
> = phaseInstrumentation()

/**
 * The answer-cleardown phase (step requests only). Runs straight after `reachability`
 * so the reachability projection, the navigation evaluation, and the answer record
 * are sampled at one point. It delegates to `evaluateAnswerCleardown`, which clears
 * the stale answers in place, then publishes the resolved codes on
 * `context.evaluation.fieldsToClear` for `getFieldsToClear()` readers. No-ops when reachability
 * is disabled (no projection was stored). Always continues — clearing is a side
 * effect, never a redirect.
 */
export const REQUEST_ANSWER_CLEARDOWN_WORK_HANDLER: WorkHandler<
  'request.answer-cleardown',
  RequestAnswerCleardownWorkProps
> = {
  kind: REQUEST_ANSWER_CLEARDOWN_KIND,

  begin() {
    return { groups: [] }
  },

  complete(ctx: WorkContextContract<RequestState, RequestAnswerCleardownWorkProps>): PhaseWorkOutput {
    const context = ctx.state.context
    const evaluation = ctx.state.reachabilityEvaluation

    if (context.evaluation.reachability === undefined || evaluation === undefined) {
      return { action: 'continue' }
    }

    context.evaluation.fieldsToClear = evaluateAnswerCleardown(context.evaluation.reachability, context.domain.answers)

    return { action: 'continue' }
  },
}

export function createRequestAnswerCleardownTask(props: RequestAnswerCleardownWorkProps) {
  return createWorkTask(
    'answer-cleardown',
    REQUEST_ANSWER_CLEARDOWN_WORK_HANDLER,
    props,
    REQUEST_ANSWER_CLEARDOWN_WORK_INSTRUMENTATION,
  )
}
