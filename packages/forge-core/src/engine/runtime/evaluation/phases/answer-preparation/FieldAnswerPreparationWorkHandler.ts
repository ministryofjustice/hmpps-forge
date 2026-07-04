import type { RequestExecutionContext } from '../../../../contracts/runtime/RequestExecutionContext.type'
import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../../../contracts/runtime/work.type'
import type { TraceSpanFields } from '../../../../diagnostics/tracing/traceSpan.type'
import type {
  AnswerPreparationFieldResult,
  FieldAnswerPreparationWorkProps,
} from '../../../../contracts/runtime/AnswerPreparationWork.type'

export const FIELD_ANSWER_PREPARATION_KIND = 'answer.preparation.field'

export const FIELD_ANSWER_PREPARATION_WORK_INSTRUMENTATION: WorkInstrumentation<
  FieldAnswerPreparationWorkProps,
  AnswerPreparationFieldResult
> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestExecutionContext, FieldAnswerPreparationWorkProps>) {
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

  async begin(ctx: WorkContextContract<RequestExecutionContext, FieldAnswerPreparationWorkProps>) {
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
