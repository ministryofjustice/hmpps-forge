import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type { WorkContextContract, WorkHandler } from '../../../chassis/contracts/work/work.type'
import { createWorkTask } from '../../../chassis/work/workTask'
import type { AccessHookWhenWorkProps } from '../contracts/AccessLifecycleWork.type'

const ACCESS_HOOK_WHEN_KIND = 'access.hook.when'

export const ACCESS_HOOK_WHEN_WORK_HANDLER: WorkHandler<'access.hook.when', AccessHookWhenWorkProps> = {
  kind: ACCESS_HOOK_WHEN_KIND,

  // A false `when` ends the hook before its effects/next run.
  async begin(ctx: WorkContextContract<RequestState, AccessHookWhenWorkProps>) {
    if (await ctx.props.evaluate()) {
      return { output: { status: 'continue' } }
    }

    return { output: { status: 'terminal', result: { executed: false, outcome: 'continue' } } }
  },
}

export function createAccessHookWhenTask(key: string, props: AccessHookWhenWorkProps) {
  return createWorkTask(key, ACCESS_HOOK_WHEN_WORK_HANDLER, props)
}
