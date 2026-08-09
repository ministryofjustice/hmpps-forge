import type { RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'
import type { CompiledSubmitHookResult } from '../contracts/hookLifecycle.type'
import type {
  CompletedWork,
  WorkContextContract,
  WorkTask,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/runtime/work.type'
import type { TraceSpanFields } from '../../../diagnostics/tracing/traceSpan.type'
import { findChildByTask, findTerminalStage, isTerminalStage } from '../../../runtime/evaluation/work/workTask'
import { isStepValid } from '../../validation/runtime/stepValidity'
import { getStepValidity } from '../../validation/runtime/stepValidityState'
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
 * group that stops at the first stage to produce a terminal result. `complete` is a
 * pure fold: return the terminal stage's result, or the "ran to completion" default.
 */
export const SUBMIT_HOOK_WORK_HANDLER: WorkHandler<'submit.hook', SubmitHookWorkProps> = {
  kind: SUBMIT_HOOK_KIND,

  begin(ctx: WorkContextContract<RequestExecutionContext, SubmitHookWorkProps>) {
    const stages: WorkTask[] = [
      ctx.props.when,
      ctx.props.guards,
      ctx.props.onAlways,
      ...(ctx.props.validation ? [ctx.props.validation] : []),
      ...(ctx.props.onValid ? [ctx.props.onValid] : []),
      ...(ctx.props.onInvalid ? [ctx.props.onInvalid] : []),
    ]

    return {
      groups: [{ mode: 'first-match', matches: stage => isTerminalStage(stage.output), children: stages }],
    }
  },

  complete(
    ctx: WorkContextContract<RequestExecutionContext, SubmitHookWorkProps>,
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

    const isValid = isStepValid(getStepValidity(ctx.request.context, ctx.request.currentStepId), {
      isSubmission: true,
      groups: ctx.props.validation?.props.groups,
    })

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
