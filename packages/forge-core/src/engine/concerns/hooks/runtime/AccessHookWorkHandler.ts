import type { RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'
import type { CompiledAccessHookResult } from '../contracts/hookLifecycle.type'
import type {
  CompletedWork,
  WorkContextContract,
  WorkTask,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/runtime/work.type'
import type { TraceSpanFields } from '../../../tracing/traceSpan.type'
import { createWorkTask, findTerminalStage, isTerminalStage } from '../../../runtime/evaluation/work/workTask'
import { ACCESS_HOOK_NEXT_WORK_INSTRUMENTATION, ACCESS_HOOK_NEXT_WORK_HANDLER } from './AccessHookNextWorkHandler'
import type { AccessHookWorkProps } from '../contracts/AccessLifecycleWork.type'

export const ACCESS_HOOK_KIND = 'access.hook'

export const ACCESS_HOOK_WORK_INSTRUMENTATION: WorkInstrumentation<AccessHookWorkProps, CompiledAccessHookResult> = {
  resolveTraceMetadataAtStart() {
    return undefined
  },

  resolveTraceMetadataAtFinish(_ctx, output) {
    return traceComplete(output)
  },
}

/**
 * A single access hook as a fixed ordered stage list: when → effects → next, run as
 * one `first-match` group that stops at the first terminal stage. `when=false` ends
 * the hook before effects run; `next` is always terminal. The `next` function prop is
 * wrapped into a stage here so the compiler keeps emitting a plain props bag.
 */
export const ACCESS_HOOK_WORK_HANDLER: WorkHandler<'access.hook', AccessHookWorkProps> = {
  kind: ACCESS_HOOK_KIND,

  begin(ctx: WorkContextContract<RequestExecutionContext, AccessHookWorkProps>) {
    const next = ctx.props.next

    const stages: WorkTask[] = [
      ...(ctx.props.when ? [ctx.props.when] : []),
      ...(ctx.props.effects ?? []),
      ...(next
        ? [createWorkTask('next', ACCESS_HOOK_NEXT_WORK_HANDLER, { next }, ACCESS_HOOK_NEXT_WORK_INSTRUMENTATION)]
        : []),
    ]

    return {
      groups: [{ mode: 'first-match', matches: stage => isTerminalStage(stage.output), children: stages }],
    }
  },

  complete(
    _ctx: WorkContextContract<RequestExecutionContext, AccessHookWorkProps>,
    children: readonly CompletedWork[],
  ): CompiledAccessHookResult {
    return findTerminalStage<CompiledAccessHookResult>(children) ?? { executed: true, outcome: 'continue' }
  },
}

function traceComplete(output: CompiledAccessHookResult): TraceSpanFields {
  return {
    executed: output.executed,
    outcome: output.outcome,
  }
}
