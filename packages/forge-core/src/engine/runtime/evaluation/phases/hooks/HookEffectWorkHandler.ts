import type { RequestExecutionContext } from '../../../../contracts/runtime/RequestExecutionContext.type'
import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../../../contracts/runtime/work.type'
import type { HookStageResult } from '../../../../contracts/runtime/HookStage.type'
import type { HookEffectWorkProps } from '../../../../contracts/runtime/HookEffectWork.type'

const HOOK_EFFECT_KIND = 'hook.effect'

export const HOOK_EFFECT_WORK_INSTRUMENTATION: WorkInstrumentation<HookEffectWorkProps, HookStageResult<never>> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestExecutionContext, HookEffectWorkProps>) {
    return { name: ctx.props.name }
  },

  resolveTraceMetadataAtFinish() {
    return undefined
  },
}

export const HOOK_EFFECT_WORK_HANDLER: WorkHandler<'hook.effect', HookEffectWorkProps> = {
  kind: HOOK_EFFECT_KIND,

  // An effect runs for its side effect and always continues — it never ends a hook.
  async begin(ctx: WorkContextContract<RequestExecutionContext, HookEffectWorkProps>) {
    await ctx.props.run()

    return { output: { status: 'continue' } }
  },
}
