import type RequestState from '../../../runtime/pipeline/RequestState'
import type { CompiledSubmitHookResult } from '../contracts/hookLifecycle.type'
import type { CompletedWork, WorkContextContract, WorkHandler } from '../../../contracts/work/work.type'
import { childOutputs, createWorkTask } from '../../../work/workTask'
import { SUBMIT_HOOK_KIND } from './SubmitHookWorkHandler'
import type { SubmitHookWorkTask, SubmitLifecycleWorkProps } from '../contracts/SubmitLifecycleWork.type'

export const SUBMIT_LIFECYCLE_KIND = 'submit.lifecycle'

export const SUBMIT_LIFECYCLE_WORK_HANDLER: WorkHandler<'submit.lifecycle', SubmitLifecycleWorkProps> = {
  kind: SUBMIT_LIFECYCLE_KIND,

  begin(ctx: WorkContextContract<RequestState, SubmitLifecycleWorkProps>) {
    return {
      groups: [
        {
          mode: 'first-match',
          matches: completedWork => isExecutedSubmitResult(completedWork.output),
          children: ctx.props.hooks,
        },
      ],
    }
  },

  complete(
    _ctx: WorkContextContract<RequestState, SubmitLifecycleWorkProps>,
    children: readonly CompletedWork[],
  ): CompiledSubmitHookResult {
    const executed = childOutputs(children, SUBMIT_HOOK_KIND).find(result => result.executed)

    return executed ?? { executed: false, validated: false, outcome: 'continue' }
  },
}

function isExecutedSubmitResult(output: unknown): boolean {
  return isSubmitHookResult(output) && output.executed
}

function isSubmitHookResult(output: unknown): output is CompiledSubmitHookResult {
  return output !== undefined &&
    output !== null &&
    typeof output === 'object' &&
    'executed' in output &&
    typeof output.executed === 'boolean'
}

export function createSubmitLifecycleTask(hooks: readonly SubmitHookWorkTask[]) {
  return createWorkTask('submit-lifecycle', SUBMIT_LIFECYCLE_WORK_HANDLER, { hooks })
}
