import type { RequestExecutionContext } from '../../../../contracts/runtime/RequestExecutionContext.type'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../../contracts/runtime/work.type'
import { singleChildOutput, singleTaskGroup } from '../../work/workTask'
import { isStepValid, stepValidity } from '../validation/stepValidity'
import { getStepValidity } from '../validation/stepValidityState'
import { STEP_VALIDATION_KIND } from '../validation/StepValidationWorkHandler'
import type { HookStageResult } from '../../../../contracts/runtime/HookStage.type'
import type { SubmitValidationWorkProps } from '../../../../contracts/runtime/SubmitLifecycleWork.type'
import type { CompiledSubmitHookResult } from '../../../../contracts/runtime/hookLifecycle.type'
import ForgeInternalError from '../../../../errors/ForgeInternalError'

export const SUBMIT_VALIDATION_KIND = 'submit.validation'

export const SUBMIT_VALIDATION_WORK_INSTRUMENTATION: WorkInstrumentation<
  SubmitValidationWorkProps,
  HookStageResult<CompiledSubmitHookResult>
> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestExecutionContext, SubmitValidationWorkProps>) {
    return { groups: ctx.props.groups }
  },

  resolveTraceMetadataAtFinish(ctx: WorkContextContract<RequestExecutionContext, SubmitValidationWorkProps>) {
    return {
      isValid: isStepValid(getStepValidity(ctx.request.context, ctx.request.currentStepId), {
        isSubmission: true,
        groups: ctx.props.groups,
      }),
    }
  },
}

/**
 * A submit hook's validation stage. Its sole child is the step's compiled validation
 * task, run by the same executor as the rest of the submit lifecycle. `complete`
 * records the result into request validation state — which the `onValid`/`onInvalid`
 * branches read to self-gate — and always continues; validation never ends the hook.
 */
export const SUBMIT_VALIDATION_WORK_HANDLER: WorkHandler<'submit.validation', SubmitValidationWorkProps> = {
  kind: SUBMIT_VALIDATION_KIND,

  async begin(ctx: WorkContextContract<RequestExecutionContext, SubmitValidationWorkProps>) {
    const stepId = ctx.request.currentStepId

    if (stepId === undefined) {
      throw new ForgeInternalError('Submit validation requires a current step id')
    }

    const validation = await ctx.request.buildStepValidation(stepId, true)

    if (validation === undefined) {
      throw new ForgeInternalError('Submit validation task missing')
    }

    return singleTaskGroup(validation)
  },

  complete(
    ctx: WorkContextContract<RequestExecutionContext, SubmitValidationWorkProps>,
    children: readonly CompletedWork[],
  ): HookStageResult<CompiledSubmitHookResult> {
    const result = singleChildOutput(children, STEP_VALIDATION_KIND)

    if (result === undefined) {
      throw new ForgeInternalError('Submit validation produced an invalid result')
    }

    const stepId = ctx.request.currentStepId

    if (stepId !== undefined) {
      ctx.request.recordStepValidation(stepId, result)
    }

    ctx.request.validation = stepValidity(getStepValidity(ctx.request.context, stepId), {
      isSubmission: true,
      groups: ctx.props.groups,
    })

    return { status: 'continue' }
  },
}
