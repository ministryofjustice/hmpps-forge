import type { RequestExecutionContext } from '../../../../contracts/runtime/RequestExecutionContext.type'
import type { CompiledAccessHookResult } from '../../../../contracts/runtime/hookLifecycle.type'
import type {
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
  WorkUnitFields,
} from '../../../../contracts/runtime/work.type'
import type { HookStageResult } from '../../../../contracts/runtime/HookStage.type'
import type { AccessHookNextWorkProps } from '../../../../contracts/runtime/AccessLifecycleWork.type'

export const ACCESS_HOOK_NEXT_KIND = 'access.hook.next'

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

  async begin(ctx: WorkContextContract<RequestExecutionContext, AccessHookNextWorkProps>) {
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

function traceComplete(output: HookStageResult<CompiledAccessHookResult>): WorkUnitFields {
  return output.status === 'terminal'
    ? { executed: output.result.executed, outcome: output.result.outcome }
    : { outcome: 'continue' }
}
