import type RequestState from '../../../runtime/pipeline/RequestState'
import type { CompiledSubmitHookResult } from '../contracts/hookLifecycle.type'
import type {
  CompletedWork,
  WorkContextContract,
  WorkTask,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/work/work.type'
import type { TraceSpanFields } from '../../../tracing/traceSpan.type'
import { createWorkTask, findChildByTask, findTerminalStage, isTerminalStage } from '../../../work/workTask'
import type { SubmitHookWorkProps } from '../contracts/SubmitLifecycleWork.type'

export const SUBMIT_HOOK_KIND = 'submit.hook'

export const SUBMIT_HOOK_WORK_INSTRUMENTATION: WorkInstrumentation<SubmitHookWorkProps, CompiledSubmitHookResult> = {
  resolveTraceMetadataAtStart() {
    return undefined
  },

  resolveTraceMetadataAtFinish(_ctx, output) {
    return traceComplete(output)
  },
}

/**
 * A single submit hook as a fixed ordered stage list: when → guards → onAlways →
 * validation → onValid → onInvalid (configured stages only), run as one `first-match`
 * group that stops at the first stage to produce a terminal result. The validation
 * stage is the validation-owned `validation.current-step` task, scheduled here so it
 * runs after `onAlways` exactly once; the hook owns only its position. `complete` is
 * a pure fold: return the terminal stage's result, or the "ran to completion"
 * default with validity read off the stored current-page result.
 */
export const SUBMIT_HOOK_WORK_HANDLER: WorkHandler<'submit.hook', SubmitHookWorkProps> = {
  kind: SUBMIT_HOOK_KIND,

  begin(ctx: WorkContextContract<RequestState, SubmitHookWorkProps>) {
    const stages: WorkTask[] = [
      ...(ctx.props.when ? [ctx.props.when] : []),
      ...(ctx.props.guards ? [ctx.props.guards] : []),
      ...(ctx.props.onAlways ? [ctx.props.onAlways] : []),
      ...(ctx.props.validation ? [ctx.props.validation] : []),
      ...(ctx.props.onValid ? [ctx.props.onValid] : []),
      ...(ctx.props.onInvalid ? [ctx.props.onInvalid] : []),
    ]

    return {
      groups: [{ mode: 'first-match', matches: stage => isTerminalStage(stage.output), children: stages }],
    }
  },

  complete(
    ctx: WorkContextContract<RequestState, SubmitHookWorkProps>,
    children: readonly CompletedWork[],
  ): CompiledSubmitHookResult {
    const terminal = findTerminalStage<CompiledSubmitHookResult>(children)

    if (terminal !== undefined) {
      return terminal
    }

    const ranValidation =
      ctx.props.validation !== undefined && findChildByTask(children, ctx.props.validation) !== undefined

    if (!ranValidation) {
      return { executed: true, validated: false, outcome: 'continue' }
    }

    const isValid = ctx.state.currentPageValidation?.isValid ?? true

    return { executed: true, validated: true, isValid, outcome: 'continue' }
  },
}

function traceComplete(output: CompiledSubmitHookResult): TraceSpanFields {
  return {
    executed: output.executed,
    validated: output.validated,
    isValid: output.isValid,
    outcome: output.outcome,
  }
}

export function createSubmitHookTask(key: string, props: SubmitHookWorkProps) {
  return createWorkTask(key, SUBMIT_HOOK_WORK_HANDLER, props, SUBMIT_HOOK_WORK_INSTRUMENTATION)
}
