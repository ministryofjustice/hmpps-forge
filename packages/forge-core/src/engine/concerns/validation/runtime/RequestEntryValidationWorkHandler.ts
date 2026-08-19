import { buildCompiledValidationContext } from '../../../runtime/context/compiledEvaluationContext'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/work/work.type'
import { createWorkTask, singleTaskGroup } from '../../../work/workTask'
import { phaseInstrumentation } from '../../../runtime/pipeline/contextSnapshot'
import {
  CURRENT_STEP_VALIDATION_WORK_HANDLER,
  CURRENT_STEP_VALIDATION_WORK_INSTRUMENTATION,
} from './CurrentStepValidationWorkHandler'
import type { CurrentStepValidationWorkProps } from '../contracts/ValidationWork.type'
import type { RequestEntryValidationWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type RequestState from '../../../runtime/pipeline/RequestState'
import type { PhaseWorkOutput } from '../../../contracts/runtime/requestPipelineOutput.type'

const REQUEST_ENTRY_VALIDATION_KIND = 'request.entry-validation'

export const REQUEST_ENTRY_VALIDATION_WORK_INSTRUMENTATION: WorkInstrumentation<
  RequestEntryValidationWorkProps,
  PhaseWorkOutput
> = phaseInstrumentation()

/**
 * The entry-validation phase as work (GET steps only). It runs the compiled
 * `validateOnEntry` selector, which combines the groups from every matching entry,
 * and — when at least one group is active — schedules the shared
 * `validation.current-step` task in non-submission mode. The task owns the whole
 * current-page operation and its result store; this phase only decides whether to
 * trigger it. With no compiled entry validation or no resolved groups, nothing runs
 * and nothing is displayed.
 */
export const REQUEST_ENTRY_VALIDATION_WORK_HANDLER: WorkHandler<
  'request.entry-validation',
  RequestEntryValidationWorkProps
> = {
  kind: REQUEST_ENTRY_VALIDATION_KIND,

  async begin(ctx: WorkContextContract<RequestState, RequestEntryValidationWorkProps>) {
    const validationContext = buildCompiledValidationContext(ctx.state.context, ctx.state.dependencies.functionRegistry)
    const groups = await ctx.props.compiled(validationContext)

    if (groups.length === 0) {
      return { groups: [] }
    }

    const props: CurrentStepValidationWorkProps = { groups, includeSubmissionOnly: false }

    return singleTaskGroup(
      createWorkTask(
        'entry-validation',
        CURRENT_STEP_VALIDATION_WORK_HANDLER,
        props,
        CURRENT_STEP_VALIDATION_WORK_INSTRUMENTATION,
      ),
    )
  },

  complete(
    _ctx: WorkContextContract<RequestState, RequestEntryValidationWorkProps>,
    _children: readonly CompletedWork[],
  ): PhaseWorkOutput {
    return { action: 'continue' }
  },
}

export function createRequestEntryValidationTask(props: RequestEntryValidationWorkProps) {
  return createWorkTask(
    'entry-validation',
    REQUEST_ENTRY_VALIDATION_WORK_HANDLER,
    props,
    REQUEST_ENTRY_VALIDATION_WORK_INSTRUMENTATION,
  )
}
