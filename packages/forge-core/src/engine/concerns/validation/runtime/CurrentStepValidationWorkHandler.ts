import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../chassis/contracts/work/work.type'
import { createWorkTask, singleChildOutput, singleTaskGroup } from '../../../chassis/work/workTask'
import { STEP_VALIDATION_KIND } from './StepValidationWorkHandler'
import type { StepValidityResult } from '../contracts/stepValidityResult.type'
import type { CurrentStepValidationWorkProps } from '../contracts/ValidationWork.type'
import type { ValidationView } from '../contracts/validationView.type'
import ForgeInternalError from '../../../errors/ForgeInternalError'

export const CURRENT_STEP_VALIDATION_KIND = 'validation.current-step'

export const CURRENT_STEP_VALIDATION_WORK_INSTRUMENTATION: WorkInstrumentation<
  CurrentStepValidationWorkProps,
  ValidationView
> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestState, CurrentStepValidationWorkProps>) {
    return { groups: ctx.props.groups, includeSubmissionOnly: ctx.props.includeSubmissionOnly }
  },

  resolveTraceMetadataAtFinish(_ctx, output) {
    return { isValid: output.isValid }
  },
}

/**
 * The single current-page validation operation. Both trigger paths schedule this
 * task — entry validation with its matching `validateOnEntry` groups, the submit
 * lifecycle (after `onAlways`) with its hook's validation groups — and the compiled
 * validation applies the group and `submissionOnly` filter before any rule
 * condition runs. `complete` stores the result on `currentPageValidation`, the one
 * request-level display signal: hook branches read its `isValid`, resolve derives
 * the render shape from its presence.
 */
export const CURRENT_STEP_VALIDATION_WORK_HANDLER: WorkHandler<
  'validation.current-step',
  CurrentStepValidationWorkProps
> = {
  kind: CURRENT_STEP_VALIDATION_KIND,

  async begin(ctx: WorkContextContract<RequestState, CurrentStepValidationWorkProps>) {
    const stepId = ctx.state.dependencies.currentStepId

    if (stepId === undefined) {
      throw new ForgeInternalError('Current-step validation requires a current step id')
    }

    const validation = await ctx.state.dependencies.buildStepValidation(stepId, ctx.props)

    if (validation === undefined) {
      throw new ForgeInternalError('Current-step validation task missing')
    }

    return singleTaskGroup(validation)
  },

  complete(
    ctx: WorkContextContract<RequestState, CurrentStepValidationWorkProps>,
    children: readonly CompletedWork[],
  ): ValidationView {
    const result = singleChildOutput(children, STEP_VALIDATION_KIND)

    if (result === undefined) {
      throw new ForgeInternalError('Current-step validation produced an invalid result')
    }

    const view = toValidationView(result)

    ctx.state.recordCurrentPageValidation(view)

    return view
  },
}

function toValidationView(result: StepValidityResult): ValidationView {
  return {
    isValid: result.fieldFailures.length === 0 && result.domainFailures.length === 0,
    fieldFailures: result.fieldFailures,
    domainFailures: result.domainFailures,
  }
}

export function createCurrentStepValidationTask(key: string, props: CurrentStepValidationWorkProps) {
  return createWorkTask(key, CURRENT_STEP_VALIDATION_WORK_HANDLER, props, CURRENT_STEP_VALIDATION_WORK_INSTRUMENTATION)
}
