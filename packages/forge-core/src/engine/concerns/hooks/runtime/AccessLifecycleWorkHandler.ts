import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type { CompiledAccessHookResult } from '../contracts/hookLifecycle.type'
import type { CompletedWork, WorkContextContract, WorkHandler } from '../../../chassis/contracts/work/work.type'
import { childOutputs, createWorkTask } from '../../../chassis/work/workTask'
import { ACCESS_HOOK_KIND } from './AccessHookWorkHandler'
import type { AccessHookWorkTask, AccessLifecycleWorkProps } from '../contracts/AccessLifecycleWork.type'

export const ACCESS_LIFECYCLE_KIND = 'access.lifecycle'

export const ACCESS_LIFECYCLE_WORK_HANDLER: WorkHandler<'access.lifecycle', AccessLifecycleWorkProps> = {
  kind: ACCESS_LIFECYCLE_KIND,

  begin(ctx: WorkContextContract<RequestState, AccessLifecycleWorkProps>) {
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
    _ctx: WorkContextContract<RequestState, AccessLifecycleWorkProps>,
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

export function createAccessLifecycleTask(hooks: readonly AccessHookWorkTask[]) {
  return createWorkTask('access-lifecycle', ACCESS_LIFECYCLE_WORK_HANDLER, { hooks })
}
