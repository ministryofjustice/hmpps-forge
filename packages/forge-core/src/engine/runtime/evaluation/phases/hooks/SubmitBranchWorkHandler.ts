import type { RequestExecutionContext } from '../../../../contracts/runtime/RequestExecutionContext.type'
import type { CompiledSubmitHookResult } from '../../../../contracts/runtime/hookLifecycle.type'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../../contracts/runtime/work.type'
import type { TraceSpanFields } from '../../../../diagnostics/tracing/traceSpan.type'
import { isStepValid } from '../validation/stepValidity'
import { getStepValidity } from '../validation/stepValidityState'
import type { HookStageResult } from '../../../../contracts/runtime/HookStage.type'
import type {
  SubmitBranchName,
  SubmitBranchWorkProps,
  SubmitHookNextResult,
} from '../../../../contracts/runtime/SubmitLifecycleWork.type'

const SUBMIT_BRANCH_KIND = 'submit.branch'

export const SUBMIT_BRANCH_WORK_INSTRUMENTATION: WorkInstrumentation<
  SubmitBranchWorkProps,
  HookStageResult<CompiledSubmitHookResult>
> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestExecutionContext, SubmitBranchWorkProps>) {
    return { name: ctx.props.name }
  },

  resolveTraceMetadataAtFinish(ctx, output) {
    return traceComplete(ctx.props, output)
  },
}

/**
 * A submit hook branch (`onAlways`, `onValid`, or `onInvalid`). It self-gates on its
 * name and the current step's validity: `onAlways` always runs; `onValid` runs only
 * when valid, `onInvalid` only when invalid. An unselected branch runs no effects,
 * continues, and drops its own (empty) trace unit. A selected branch runs its effects
 * then `next()`, ending the hook on a redirect/error and otherwise continuing.
 */
export const SUBMIT_BRANCH_WORK_HANDLER: WorkHandler<'submit.branch', SubmitBranchWorkProps> = {
  kind: SUBMIT_BRANCH_KIND,

  begin(ctx: WorkContextContract<RequestExecutionContext, SubmitBranchWorkProps>) {
    if (!isSelected(ctx.props.name, currentStepValid(ctx))) {
      return { groups: [] }
    }

    return { groups: [{ mode: 'sequential', children: ctx.props.effects }] }
  },

  async complete(
    ctx: WorkContextContract<RequestExecutionContext, SubmitBranchWorkProps>,
    _children: readonly CompletedWork[],
  ): Promise<HookStageResult<CompiledSubmitHookResult>> {
    if (!isSelected(ctx.props.name, currentStepValid(ctx))) {
      ctx.omitFromTrace?.()

      return { status: 'continue' }
    }

    const result = toSubmitResult(await ctx.props.next(), ctx.props.name)

    return result === undefined ? { status: 'continue' } : { status: 'terminal', result }
  },
}

function currentStepValid(ctx: WorkContextContract<RequestExecutionContext, SubmitBranchWorkProps>): boolean {
  return isStepValid(getStepValidity(ctx.request.context, ctx.request.currentStepId), {
    isSubmission: true,
    groups: ctx.props.groups,
  })
}

function isSelected(name: SubmitBranchName, isValid: boolean): boolean {
  if (name === 'onAlways') {
    return true
  }

  return name === 'onValid' ? isValid : !isValid
}

function toSubmitResult(outcome: SubmitHookNextResult, name: SubmitBranchName): CompiledSubmitHookResult | undefined {
  const validatedPart = name === 'onAlways' ? { validated: false } : { validated: true, isValid: name === 'onValid' }

  if (outcome?.type === 'redirect') {
    return { executed: true, ...validatedPart, outcome: 'redirect', redirect: outcome.value }
  }

  if (outcome?.type === 'error') {
    return {
      executed: true,
      ...validatedPart,
      outcome: 'error',
      status: outcome.value.status,
      message: outcome.value.message,
    }
  }

  return undefined
}

function traceComplete(
  props: SubmitBranchWorkProps,
  output: HookStageResult<CompiledSubmitHookResult>,
): TraceSpanFields {
  return {
    name: props.name,
    outcome: output.status === 'terminal' ? output.result.outcome : 'continue',
  }
}
