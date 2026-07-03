import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
  WorkUnitFields,
} from '../../../../contracts/runtime/work.type'
import { childOutputs } from '../../work/workTask'
import type { RequestExecutionContext } from '../../../../contracts/runtime/RequestExecutionContext.type'
import { FIELD_ANSWER_PREPARATION_KIND } from './FieldAnswerPreparationWorkHandler'
import type {
  AnswerPreparationResult,
  AnswerPreparationWorkProps,
} from '../../../../contracts/runtime/AnswerPreparationWork.type'

export const ANSWER_PREPARATION_KIND = 'answer.preparation'

export const ANSWER_PREPARATION_WORK_INSTRUMENTATION: WorkInstrumentation<
  AnswerPreparationWorkProps,
  AnswerPreparationResult
> = {
  resolveTraceMetadataAtStart() {
    return undefined
  },

  resolveTraceMetadataAtFinish(ctx: WorkContextContract<RequestExecutionContext, AnswerPreparationWorkProps>) {
    return traceComplete(ctx)
  },
}

export const ANSWER_PREPARATION_WORK_HANDLER: WorkHandler<'answer.preparation', AnswerPreparationWorkProps> = {
  kind: ANSWER_PREPARATION_KIND,

  begin(ctx: WorkContextContract<RequestExecutionContext, AnswerPreparationWorkProps>) {
    return {
      groups: [
        {
          mode: 'sequential',
          children: ctx.props.fields,
        },
      ],
    }
  },

  complete(
    _ctx: WorkContextContract<RequestExecutionContext, AnswerPreparationWorkProps>,
    children: readonly CompletedWork[],
  ): AnswerPreparationResult {
    return {
      fields: childOutputs(children, FIELD_ANSWER_PREPARATION_KIND),
    }
  },
}

function traceComplete(ctx: WorkContextContract<RequestExecutionContext>): WorkUnitFields {
  return {
    answers: ctx.request.context.domain.answers,
  }
}
