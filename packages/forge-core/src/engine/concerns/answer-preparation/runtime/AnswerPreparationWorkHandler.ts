import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../chassis/contracts/work/work.type'
import type { TraceSpanFields } from '../../../chassis/tracing/traceSpan.type'
import { childOutputs, createWorkTask } from '../../../chassis/work/workTask'
import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import { FIELD_ANSWER_PREPARATION_KIND } from './FieldAnswerPreparationWorkHandler'
import type {
  AnswerPreparationResult,
  AnswerPreparationWorkProps,
  FieldAnswerPreparationWorkTask,
} from '../contracts/AnswerPreparationWork.type'

export const ANSWER_PREPARATION_KIND = 'answer.preparation'

export const ANSWER_PREPARATION_WORK_INSTRUMENTATION: WorkInstrumentation<
  AnswerPreparationWorkProps,
  AnswerPreparationResult
> = {
  resolveTraceMetadataAtStart() {
    return undefined
  },

  resolveTraceMetadataAtFinish(ctx: WorkContextContract<RequestState, AnswerPreparationWorkProps>) {
    return traceComplete(ctx)
  },
}

export const ANSWER_PREPARATION_WORK_HANDLER: WorkHandler<'answer.preparation', AnswerPreparationWorkProps> = {
  kind: ANSWER_PREPARATION_KIND,

  begin(ctx: WorkContextContract<RequestState, AnswerPreparationWorkProps>) {
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
    _ctx: WorkContextContract<RequestState, AnswerPreparationWorkProps>,
    children: readonly CompletedWork[],
  ): AnswerPreparationResult {
    return {
      fields: childOutputs(children, FIELD_ANSWER_PREPARATION_KIND),
    }
  },
}

function traceComplete(ctx: WorkContextContract<RequestState>): TraceSpanFields {
  return {
    answers: ctx.state.context.domain.answers,
  }
}

export function createAnswerPreparationTask(fields: readonly FieldAnswerPreparationWorkTask[]) {
  const props: AnswerPreparationWorkProps = { fields }

  return createWorkTask(
    'answer-preparation',
    ANSWER_PREPARATION_WORK_HANDLER,
    props,
    ANSWER_PREPARATION_WORK_INSTRUMENTATION,
  )
}
