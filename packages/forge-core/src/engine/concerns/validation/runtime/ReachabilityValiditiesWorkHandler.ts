import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../chassis/contracts/work/work.type'
import { createWorkTask } from '../../../chassis/work/workTask'
import { phaseInstrumentation } from '../../../chassis/runtime/pipeline/contextSnapshot'
import { validationTaskKey } from './stepValidationStore'
import { isStepValidityResult, recordReachabilityValidity } from './reachabilityValidityState'
import type { ValidationRuleFilter } from '../contracts/ValidationWork.type'
import type { RequestValiditiesWorkProps } from '../../../chassis/contracts/runtime/RequestPipelineWork.type'
import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type { PhaseWorkOutput } from '../../../chassis/contracts/runtime/requestPipelineOutput.type'

const REQUEST_VALIDITIES_KIND = 'request.validities'

// Reachability needs each step's default-group, non-submission validity, so
// `submissionOnly` and off-default rules never run in — or gate — this round.
const REACHABILITY_VALIDATION_FILTER: ValidationRuleFilter = { groups: ['default'], includeSubmissionOnly: false }

export const REACHABILITY_VALIDITIES_WORK_INSTRUMENTATION: WorkInstrumentation<
  RequestValiditiesWorkProps,
  PhaseWorkOutput
> = phaseInstrumentation()

/**
 * The reachability validities phase. Runs before navigation on every request and
 * validates every step that has a compiled validation, once, under the
 * reachability filter (default group, no `submissionOnly` rules). It fans the
 * per-step tasks out as one concurrent group and records each result into
 * `context.evaluation.reachabilityValidities` keyed by step id, for the
 * reachability walk to read. The current step is included: resume and frontier
 * resolution need its navigation validity, and this phase runs before either
 * current-page trigger could supply one. Its result here is a navigation fact
 * only — this phase never touches `currentPageValidation` or validation display,
 * which belong exclusively to the `validation.current-step` operation.
 *
 * `complete` rebuilds the task-key → step-id index from the props (the same
 * `validationTaskKey` the tasks were built under), so each result maps
 * back to its step without a per-unit side-channel. Each result maps to a
 * distinct step key, so there is no shared slot to clobber. Steps with no
 * compiled validation are absent from the map and are treated as valid by the walk.
 */
export const REACHABILITY_VALIDITIES_WORK_HANDLER: WorkHandler<'request.validities', RequestValiditiesWorkProps> = {
  kind: REQUEST_VALIDITIES_KIND,

  async begin(ctx: WorkContextContract<RequestState, RequestValiditiesWorkProps>) {
    const tasks = await Promise.all(
      [...ctx.props.compiledStepValidations.keys()].map(stepId =>
        ctx.state.dependencies.buildStepValidation(stepId, REACHABILITY_VALIDATION_FILTER),
      ),
    )
    const present = tasks.filter(task => task !== undefined)

    if (present.length === 0) {
      return { groups: [] }
    }

    return {
      groups: [{ mode: 'concurrent', children: present }],
    }
  },

  complete(
    ctx: WorkContextContract<RequestState, RequestValiditiesWorkProps>,
    children: readonly CompletedWork[],
  ): PhaseWorkOutput {
    const stepIdByKey = new Map(
      [...ctx.props.compiledStepValidations.keys()].map(stepId => [validationTaskKey(stepId), stepId] as const),
    )

    // Read by key (each child maps back to its step by task key), so the
    // per-kind accessor doesn't apply; narrow the erased child output here.
    children.forEach(child => {
      const stepId = stepIdByKey.get(child.key)

      if (stepId !== undefined && isStepValidityResult(child.output)) {
        recordReachabilityValidity(ctx.state.context, stepId, child.output)
      }
    })

    return { action: 'continue' }
  },
}

export function createReachabilityValiditiesTask(props: RequestValiditiesWorkProps) {
  return createWorkTask(
    'validities',
    REACHABILITY_VALIDITIES_WORK_HANDLER,
    props,
    REACHABILITY_VALIDITIES_WORK_INSTRUMENTATION,
  )
}
