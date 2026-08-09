import type { RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'
import type { CompiledAccessHookResult } from '../contracts/hookLifecycle.type'
import type { CompletedWork, WorkContextContract, WorkHandler } from '../../../contracts/runtime/work.type'
import { childOutputs } from '../../../runtime/evaluation/work/workTask'
import { ACCESS_HOOK_KIND } from './AccessHookWorkHandler'
import type { AccessLifecycleWorkProps } from '../contracts/AccessLifecycleWork.type'

export const ACCESS_LIFECYCLE_KIND = 'access.lifecycle'

export const ACCESS_LIFECYCLE_WORK_HANDLER: WorkHandler<'access.lifecycle', AccessLifecycleWorkProps> = {
  kind: ACCESS_LIFECYCLE_KIND,

  begin(ctx: WorkContextContract<RequestExecutionContext, AccessLifecycleWorkProps>) {
    return {
      groups: [
        {
          mode: 'first-match',
          matches: completedWork => isHaltingAccessResult(completedWork.output),
          children: ctx.props.hooks,
        },
      ],
    }
  },

  complete(
    _ctx: WorkContextContract<RequestExecutionContext, AccessLifecycleWorkProps>,
    children: readonly CompletedWork[],
  ): CompiledAccessHookResult {
    const halting = childOutputs(children, ACCESS_HOOK_KIND).find(result => result.outcome !== 'continue')

    return halting ?? { executed: true, outcome: 'continue' }
  },
}

function isHaltingAccessResult(output: unknown): boolean {
  return isAccessHookResult(output) && output.outcome !== 'continue'
}

function isAccessHookResult(output: unknown): output is CompiledAccessHookResult {
  return output !== undefined &&
    output !== null &&
    typeof output === 'object' &&
    'outcome' in output &&
    typeof output.outcome === 'string'
}
