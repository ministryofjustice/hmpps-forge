import type { RequestExecutionContext } from '../../../../contracts/runtime/RequestExecutionContext.type'
import type { CompiledSubmitHookResult } from '../../../../contracts/runtime/hookLifecycle.type'
import type { CompletedWork, WorkContextContract, WorkHandler } from '../../../../contracts/runtime/work.type'
import { childOutputs } from '../../work/workTask'
import { SUBMIT_HOOK_KIND } from './SubmitHookWorkHandler'
import type { SubmitLifecycleWorkProps } from '../../../../contracts/runtime/SubmitLifecycleWork.type'

export const SUBMIT_LIFECYCLE_KIND = 'submit.lifecycle'

export const SUBMIT_LIFECYCLE_WORK_HANDLER: WorkHandler<'submit.lifecycle', SubmitLifecycleWorkProps> = {
  kind: SUBMIT_LIFECYCLE_KIND,

  begin(ctx: WorkContextContract<RequestExecutionContext, SubmitLifecycleWorkProps>) {
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
    _ctx: WorkContextContract<RequestExecutionContext, SubmitLifecycleWorkProps>,
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
