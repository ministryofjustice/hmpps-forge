import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type { CompiledAccessHookResult } from '../contracts/hookLifecycle.type'
import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../../chassis/contracts/work/work.type'
import type { TraceSpanFields } from '../../../chassis/tracing/traceSpan.type'
import type { HookStageResult } from '../contracts/HookStage.type'
import type { AccessHookNextWorkProps } from '../contracts/AccessLifecycleWork.type'

const ACCESS_HOOK_NEXT_KIND = 'access.hook.next'

export const ACCESS_HOOK_NEXT_WORK_INSTRUMENTATION: WorkInstrumentation<
  AccessHookNextWorkProps,
  HookStageResult<CompiledAccessHookResult>
> = {
  resolveTraceMetadataAtStart() {
    return undefined
  },

  resolveTraceMetadataAtFinish(_ctx, output) {
    return traceComplete(output)
  },
}

/**
 * The terminal stage of an access hook: runs the hook's `next` function and maps its
 * outcome to the access result. Always terminal — it is the last stage, and a hook
 * that reaches `next` has executed, so `next` decides the hook's outcome.
 */
export const ACCESS_HOOK_NEXT_WORK_HANDLER: WorkHandler<'access.hook.next', AccessHookNextWorkProps> = {
  kind: ACCESS_HOOK_NEXT_KIND,

  async begin(ctx: WorkContextContract<RequestState, AccessHookNextWorkProps>) {
    const outcome = await ctx.props.next()

    if (outcome?.type === 'redirect') {
      return {
        output: { status: 'terminal', result: { executed: true, outcome: 'redirect', redirect: outcome.value } },
      }
    }

    if (outcome?.type === 'error') {
      return {
        output: {
          status: 'terminal',
          result: { executed: true, outcome: 'error', status: outcome.value.status, message: outcome.value.message },
        },
      }
    }

    return { output: { status: 'terminal', result: { executed: true, outcome: 'continue' } } }
  },
}

function traceComplete(output: HookStageResult<CompiledAccessHookResult>): TraceSpanFields {
  return output.status === 'terminal'
    ? { executed: output.result.executed, outcome: output.result.outcome }
    : { outcome: 'continue' }
}
