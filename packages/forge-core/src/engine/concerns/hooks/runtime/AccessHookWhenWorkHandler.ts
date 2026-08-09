import type { RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'
import type { WorkContextContract, WorkHandler } from '../../../contracts/runtime/work.type'
import type { AccessHookWhenWorkProps } from '../contracts/AccessLifecycleWork.type'

const ACCESS_HOOK_WHEN_KIND = 'access.hook.when'

export const ACCESS_HOOK_WHEN_WORK_HANDLER: WorkHandler<'access.hook.when', AccessHookWhenWorkProps> = {
  kind: ACCESS_HOOK_WHEN_KIND,

  // A false `when` ends the hook before its effects/next run.
  async begin(ctx: WorkContextContract<RequestExecutionContext, AccessHookWhenWorkProps>) {
    if (await ctx.props.evaluate()) {
      return { output: { status: 'continue' } }
    }

    return { output: { status: 'terminal', result: { executed: false, outcome: 'continue' } } }
  },
}
