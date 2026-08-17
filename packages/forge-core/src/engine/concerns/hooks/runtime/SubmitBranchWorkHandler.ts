import type RequestState from '../../../runtime/pipeline/RequestState'
import type { CompiledSubmitHookResult } from '../contracts/hookLifecycle.type'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/work/work.type'
import type { TraceSpanFields } from '../../../tracing/traceSpan.type'
import { createWorkTask } from '../../../work/workTask'
import type { HookStageResult } from '../contracts/HookStage.type'
import type {
  SubmitBranchName,
  SubmitBranchWorkProps,
  SubmitHookNextResult,
} from '../contracts/SubmitLifecycleWork.type'

const SUBMIT_BRANCH_KIND = 'submit.branch'

export const SUBMIT_BRANCH_WORK_INSTRUMENTATION: WorkInstrumentation<
  SubmitBranchWorkProps,
  HookStageResult<CompiledSubmitHookResult>
> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestState, SubmitBranchWorkProps>) {
    return { name: ctx.props.name }
  },

  resolveTraceMetadataAtFinish(ctx, output) {
    return traceComplete(ctx.props, output)
  },
}

/**
 * A submit hook branch (`onAlways`, `onValid`, or `onInvalid`). It self-gates on its
 * name and the stored current-page validity: `onAlways` always runs; `onValid` runs
 * only when valid, `onInvalid` only when invalid. An unselected branch runs no effects,
 * continues, and drops its own (empty) trace unit. A selected branch runs its effects
 * then `next()`, ending the hook on a redirect/error and otherwise continuing.
 */
export const SUBMIT_BRANCH_WORK_HANDLER: WorkHandler<'submit.branch', SubmitBranchWorkProps> = {
  kind: SUBMIT_BRANCH_KIND,

  begin(ctx: WorkContextContract<RequestState, SubmitBranchWorkProps>) {
    if (!isSelected(ctx.props.name, currentStepValid(ctx))) {
      return { groups: [] }
    }

    return { groups: [{ mode: 'sequential', children: ctx.props.effects ?? [] }] }
  },

  async complete(
    ctx: WorkContextContract<RequestState, SubmitBranchWorkProps>,
    _children: readonly CompletedWork[],
  ): Promise<HookStageResult<CompiledSubmitHookResult>> {
    if (!isSelected(ctx.props.name, currentStepValid(ctx))) {
      ctx.omitFromTrace?.()

      return { status: 'continue' }
    }

    const result = toSubmitResult(await ctx.props.next?.(), ctx.props.name)

    return result === undefined ? { status: 'continue' } : { status: 'terminal', result }
  },
}

function currentStepValid(ctx: WorkContextContract<RequestState, SubmitBranchWorkProps>): boolean {
  return ctx.state.currentPageValidation?.isValid ?? true
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

export function createSubmitBranchTask(key: string, props: SubmitBranchWorkProps) {
  return createWorkTask(key, SUBMIT_BRANCH_WORK_HANDLER, props, SUBMIT_BRANCH_WORK_INSTRUMENTATION)
}
