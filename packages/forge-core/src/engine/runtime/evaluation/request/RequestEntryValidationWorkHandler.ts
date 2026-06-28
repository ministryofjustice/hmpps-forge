import { buildCompiledValidationContext } from '../context/compiledEvaluationContext'
import { stepValidity } from '../phases/validation/stepValidity'
import { getStepValidity } from '../phases/validation/stepValidityState'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/runtime/work.type'
import { phaseInstrumentation } from './requestPhase'
import type { RequestEntryValidationWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type { PhaseWorkOutput, RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'

export const REQUEST_ENTRY_VALIDATION_KIND = 'request.entry-validation'

export const REQUEST_ENTRY_VALIDATION_WORK_INSTRUMENTATION: WorkInstrumentation<
  RequestEntryValidationWorkProps,
  PhaseWorkOutput
> = phaseInstrumentation()

/**
 * The entry-validation phase as work (GET steps only). It computes nothing: the eager
 * `validities` phase already ran every non-`submissionOnly` rule across all groups for
 * every step. This phase only selects which groups to surface on GET — running the
 * compiled entry selector for its active groups, then projecting the current step's
 * stored failure set in non-submission mode onto `request.validation` for render.
 * Optional: with no compiled entry validation, or no resolved groups, it shows nothing.
 */
export const REQUEST_ENTRY_VALIDATION_WORK_HANDLER: WorkHandler<
  'request.entry-validation',
  RequestEntryValidationWorkProps
> = {
  kind: REQUEST_ENTRY_VALIDATION_KIND,

  async begin(ctx: WorkContextContract<RequestExecutionContext, RequestEntryValidationWorkProps>) {
    if (!ctx.props.compiled) {
      return { groups: [] }
    }

    const validationContext = buildCompiledValidationContext(ctx.request.context, ctx.request.functionRegistry)
    const groups = await ctx.props.compiled(validationContext)

    if (groups.length === 0) {
      return { groups: [] }
    }

    ctx.request.validation = stepValidity(getStepValidity(ctx.request.context, ctx.request.currentStepId), {
      isSubmission: false,
      groups,
    })
    ctx.request.showValidationFailures = true

    return { groups: [] }
  },

  complete(
    _ctx: WorkContextContract<RequestExecutionContext, RequestEntryValidationWorkProps>,
    _children: readonly CompletedWork[],
  ): PhaseWorkOutput {
    return { action: 'continue' }
  },
}
