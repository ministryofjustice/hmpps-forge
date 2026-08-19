import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../../chassis/contracts/work/work.type'
import type { TraceSpanFields } from '../../../chassis/tracing/traceSpan.type'
import { createWorkTask } from '../../../chassis/work/workTask'
import type {
  AnswerPreparationFieldResult,
  FieldAnswerPreparationWorkProps,
} from '../contracts/AnswerPreparationWork.type'

export const FIELD_ANSWER_PREPARATION_KIND = 'answer.preparation.field'

export const FIELD_ANSWER_PREPARATION_WORK_INSTRUMENTATION: WorkInstrumentation<
  FieldAnswerPreparationWorkProps,
  AnswerPreparationFieldResult
> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestState, FieldAnswerPreparationWorkProps>) {
    return {
      code: ctx.props.code,
      mode: ctx.props.mode,
    }
  },

  resolveTraceMetadataAtFinish(_ctx, output) {
    return traceComplete(output)
  },
}

export const FIELD_ANSWER_PREPARATION_WORK_HANDLER: WorkHandler<
  'answer.preparation.field',
  FieldAnswerPreparationWorkProps
> = {
  kind: FIELD_ANSWER_PREPARATION_KIND,

  async begin(ctx: WorkContextContract<RequestState, FieldAnswerPreparationWorkProps>) {
    return { output: await ctx.props.run() }
  },
}

function traceComplete(output: AnswerPreparationFieldResult): TraceSpanFields {
  return {
    code: output.code,
    mode: output.mode,
    mutationCount: output.mutations.length,
    parsed: output.parsed !== undefined,
  }
}

export function createFieldAnswerPreparationTask(key: string, props: FieldAnswerPreparationWorkProps) {
  return createWorkTask(
    key,
    FIELD_ANSWER_PREPARATION_WORK_HANDLER,
    props,
    FIELD_ANSWER_PREPARATION_WORK_INSTRUMENTATION,
  )
}
