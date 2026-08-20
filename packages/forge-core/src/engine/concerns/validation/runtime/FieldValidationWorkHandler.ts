import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../../chassis/contracts/work/work.type'
import type { TraceSpanFields } from '../../../chassis/tracing/traceSpan.type'
import type { StepValidationFailure } from '../../../chassis/contracts/runtime/evaluationState.type'
import { createWorkTask } from '../../../chassis/work/workTask'
import type { FieldValidationWorkProps } from '../contracts/ValidationWork.type'

export const FIELD_VALIDATION_KIND = 'validation.field'

export const FIELD_VALIDATION_WORK_INSTRUMENTATION: WorkInstrumentation<
  FieldValidationWorkProps,
  readonly StepValidationFailure[]
> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestState, FieldValidationWorkProps>) {
    return traceBegin(ctx.props)
  },

  resolveTraceMetadataAtFinish(_ctx, output) {
    return { failures: output.length }
  },
}

export const FIELD_VALIDATION_WORK_HANDLER: WorkHandler<'validation.field', FieldValidationWorkProps> = {
  kind: FIELD_VALIDATION_KIND,

  async begin(ctx: WorkContextContract<RequestState, FieldValidationWorkProps>) {
    return { output: await ctx.props.run() }
  },
}

function traceBegin(props: FieldValidationWorkProps): TraceSpanFields {
  return {
    blockId: props.blockId,
    blockCode: props.blockCode,
  }
}

export function createFieldValidationTask(key: string, props: FieldValidationWorkProps) {
  return createWorkTask(key, FIELD_VALIDATION_WORK_HANDLER, props, FIELD_VALIDATION_WORK_INSTRUMENTATION)
}
