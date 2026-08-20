import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../../chassis/contracts/work/work.type'
import type { HookStageResult } from '../contracts/HookStage.type'
import { createWorkTask } from '../../../chassis/work/workTask'
import type { HookEffectWorkProps } from '../contracts/HookEffectWork.type'

const HOOK_EFFECT_KIND = 'hook.effect'

export const HOOK_EFFECT_WORK_INSTRUMENTATION: WorkInstrumentation<HookEffectWorkProps, HookStageResult<never>> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestState, HookEffectWorkProps>) {
    return { name: ctx.props.name }
  },

  resolveTraceMetadataAtFinish() {
    return undefined
  },
}

export const HOOK_EFFECT_WORK_HANDLER: WorkHandler<'hook.effect', HookEffectWorkProps> = {
  kind: HOOK_EFFECT_KIND,

  // An effect runs for its side effect and always continues — it never ends a hook.
  async begin(ctx: WorkContextContract<RequestState, HookEffectWorkProps>) {
    await ctx.props.run()

    return { output: { status: 'continue' } }
  },
}

export function createHookEffectTask(key: string, props: HookEffectWorkProps) {
  return createWorkTask(key, HOOK_EFFECT_WORK_HANDLER, props, HOOK_EFFECT_WORK_INSTRUMENTATION)
}
