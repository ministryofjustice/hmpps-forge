import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/runtime/work.type'
import { phaseInstrumentation } from './requestPhase'
import { validationTaskKey } from '../phases/validation/stepValidationStore'
import { isStepValidityResult } from '../phases/validation/stepValidityState'
import type { RequestValiditiesWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type { PhaseWorkOutput, RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'

const REQUEST_VALIDITIES_KIND = 'request.validities'

export const REQUEST_VALIDITIES_WORK_INSTRUMENTATION: WorkInstrumentation<RequestValiditiesWorkProps, PhaseWorkOutput> =
  phaseInstrumentation()

/**
 * The eager validities phase. Runs before navigation on every request and
 * validates every step that has a compiled validation, once, in reachability mode
 * (`isSubmission: false`, the default group). It fans the per-step tasks out
 * as one concurrent group and records each result into `context.evaluation.stepValidities`
 * keyed by step id, for navigation to read.
 *
 * `complete` rebuilds the task-key → step-id index from the props (the same
 * `validationTaskKey` the tasks were built under), so each result maps
 * back to its step without a per-unit side-channel. Each result maps to a
 * distinct step key, so there is no shared slot to clobber. Steps with no
 * compiled validation are absent from the map and are treated as valid by the walk.
 */
export const REQUEST_VALIDITIES_WORK_HANDLER: WorkHandler<'request.validities', RequestValiditiesWorkProps> = {
  kind: REQUEST_VALIDITIES_KIND,

  async begin(ctx: WorkContextContract<RequestExecutionContext, RequestValiditiesWorkProps>) {
    const tasks = await Promise.all(
      [...ctx.props.compiledStepValidations.keys()].map(stepId => ctx.request.buildStepValidation(stepId, false)),
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
    ctx: WorkContextContract<RequestExecutionContext, RequestValiditiesWorkProps>,
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
        ctx.request.recordStepValidation(stepId, child.output)
      }
    })

    return { action: 'continue' }
  },
}
