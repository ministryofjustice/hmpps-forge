import type { RequestExecutionContext } from '../../../../contracts/runtime/RequestExecutionContext.type'
import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../../../contracts/runtime/work.type'
import type { CompiledSubmitHookResult } from '../../../../contracts/runtime/hookLifecycle.type'
import type { HookStageResult } from '../../../../contracts/runtime/HookStage.type'
import type { SubmitHookPredicateWorkProps } from '../../../../contracts/runtime/SubmitLifecycleWork.type'

const SUBMIT_HOOK_PREDICATE_KIND = 'submit.predicate'

export const SUBMIT_HOOK_PREDICATE_WORK_INSTRUMENTATION: WorkInstrumentation<
  SubmitHookPredicateWorkProps,
  HookStageResult<CompiledSubmitHookResult>
> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestExecutionContext, SubmitHookPredicateWorkProps>) {
    return { name: ctx.props.name }
  },

  resolveTraceMetadataAtFinish(_ctx, output) {
    return { passed: output.status === 'continue' }
  },
}

export const SUBMIT_HOOK_PREDICATE_WORK_HANDLER: WorkHandler<'submit.predicate', SubmitHookPredicateWorkProps> = {
  kind: SUBMIT_HOOK_PREDICATE_KIND,

  // A failed predicate (when/guards) ends the hook: it owns the "not executed" result.
  async begin(ctx: WorkContextContract<RequestExecutionContext, SubmitHookPredicateWorkProps>) {
    if (await ctx.props.evaluate()) {
      return { output: { status: 'continue' } }
    }

    return { output: { status: 'terminal', result: { executed: false, validated: false, outcome: 'continue' } } }
  },
}
