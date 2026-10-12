import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../chassis/contracts/work/work.type'
import { createWorkTask } from '../../../chassis/work/workTask'
import { phaseInstrumentation } from '../../../chassis/runtime/pipeline/contextSnapshot'
import type { RequestAnswerPreparationWorkProps } from '../../../chassis/contracts/runtime/RequestPipelineWork.type'
import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type { PhaseWorkOutput } from '../../../chassis/contracts/runtime/requestPipelineOutput.type'
import { runCompiledAnswerPreparation } from './RequestAnswerPreparationWorkHandler'

const REQUEST_ANSWER_RECONCILIATION_KIND = 'request.answer-reconciliation'

export const REQUEST_ANSWER_RECONCILIATION_WORK_INSTRUMENTATION: WorkInstrumentation<
  RequestAnswerPreparationWorkProps,
  PhaseWorkOutput
> = phaseInstrumentation()

/**
 * The journey-wide reconcile phase as work. It runs the parent journey's
 * compiled reconcile pass over every owned step's fields, so a `dependentWhen`
 * that reads an answer from another step is re-evaluated even though this
 * request only rendered one form. The pass never reads the post body, so a
 * field absent from this request's body keeps its stored answer.
 */
export const REQUEST_ANSWER_RECONCILIATION_WORK_HANDLER: WorkHandler<
  'request.answer-reconciliation',
  RequestAnswerPreparationWorkProps
> = {
  kind: REQUEST_ANSWER_RECONCILIATION_KIND,

  begin(ctx: WorkContextContract<RequestState, RequestAnswerPreparationWorkProps>) {
    return runCompiledAnswerPreparation(ctx)
  },

  complete(
    _ctx: WorkContextContract<RequestState, RequestAnswerPreparationWorkProps>,
    _children: readonly CompletedWork[],
  ): PhaseWorkOutput {
    return { action: 'continue' }
  },
}

export function createRequestAnswerReconciliationTask(props: RequestAnswerPreparationWorkProps) {
  return createWorkTask(
    'answer-reconciliation',
    REQUEST_ANSWER_RECONCILIATION_WORK_HANDLER,
    props,
    REQUEST_ANSWER_RECONCILIATION_WORK_INSTRUMENTATION,
  )
}
