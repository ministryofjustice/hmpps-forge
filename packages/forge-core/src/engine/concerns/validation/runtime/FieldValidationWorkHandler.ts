import type { RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'
import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../../contracts/runtime/work.type'
import type { TraceSpanFields } from '../../../tracing/traceSpan.type'
import type { StepValidationFailure } from '../../../contracts/runtime/evaluationState.type'
import type { FieldValidationWorkProps } from '../contracts/ValidationWork.type'

export const FIELD_VALIDATION_KIND = 'validation.field'

export const FIELD_VALIDATION_WORK_INSTRUMENTATION: WorkInstrumentation<
  FieldValidationWorkProps,
  readonly StepValidationFailure[]
> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestExecutionContext, FieldValidationWorkProps>) {
    return traceBegin(ctx.props)
  },

  resolveTraceMetadataAtFinish(_ctx, output) {
    return { failures: output.length }
  },
}

export const FIELD_VALIDATION_WORK_HANDLER: WorkHandler<'validation.field', FieldValidationWorkProps> = {
  kind: FIELD_VALIDATION_KIND,

  async begin(ctx: WorkContextContract<RequestExecutionContext, FieldValidationWorkProps>) {
    return { output: await ctx.props.run() }
  },
}

function traceBegin(props: FieldValidationWorkProps): TraceSpanFields {
  return {
    blockId: props.blockId,
    blockCode: props.blockCode,
  }
}
