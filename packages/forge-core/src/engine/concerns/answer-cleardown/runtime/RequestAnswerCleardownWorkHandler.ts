import { evaluateAnswerCleardown } from './evaluateAnswerCleardown'
import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../../contracts/runtime/work.type'
import { phaseInstrumentation } from '../../../runtime/evaluation/request/requestPhase'
import type { RequestAnswerCleardownWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type { PhaseWorkOutput, RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'

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

  complete(ctx: WorkContextContract<RequestExecutionContext, RequestAnswerCleardownWorkProps>): PhaseWorkOutput {
    const context = ctx.request.context
    const evaluation = ctx.request.reachabilityEvaluation

    if (context.evaluation.reachability === undefined || evaluation === undefined) {
      return { action: 'continue' }
    }

    context.evaluation.fieldsToClear = evaluateAnswerCleardown(context.evaluation.reachability, context.domain.answers)

    return { action: 'continue' }
  },
}
