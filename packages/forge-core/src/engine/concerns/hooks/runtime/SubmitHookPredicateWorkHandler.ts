import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../../chassis/contracts/work/work.type'
import type { CompiledSubmitHookResult } from '../contracts/hookLifecycle.type'
import type { HookStageResult } from '../contracts/HookStage.type'
import { createWorkTask } from '../../../chassis/work/workTask'
import type { SubmitHookPredicateWorkProps } from '../contracts/SubmitLifecycleWork.type'

const SUBMIT_HOOK_PREDICATE_KIND = 'submit.predicate'

export const SUBMIT_HOOK_PREDICATE_WORK_INSTRUMENTATION: WorkInstrumentation<
  SubmitHookPredicateWorkProps,
  HookStageResult<CompiledSubmitHookResult>
> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestState, SubmitHookPredicateWorkProps>) {
    return { name: ctx.props.name }
  },

  resolveTraceMetadataAtFinish(_ctx, output) {
    return { passed: output.status === 'continue' }
  },
}

export const SUBMIT_HOOK_PREDICATE_WORK_HANDLER: WorkHandler<'submit.predicate', SubmitHookPredicateWorkProps> = {
  kind: SUBMIT_HOOK_PREDICATE_KIND,

  // A failed predicate (when/guards) ends the hook: it owns the "not executed" result.
  async begin(ctx: WorkContextContract<RequestState, SubmitHookPredicateWorkProps>) {
    if (await ctx.props.evaluate()) {
      return { output: { status: 'continue' } }
    }

    return { output: { status: 'terminal', result: { executed: false, validated: false, outcome: 'continue' } } }
  },
}

export function createSubmitPredicateTask(key: string, props: SubmitHookPredicateWorkProps) {
  return createWorkTask(key, SUBMIT_HOOK_PREDICATE_WORK_HANDLER, props, SUBMIT_HOOK_PREDICATE_WORK_INSTRUMENTATION)
}
