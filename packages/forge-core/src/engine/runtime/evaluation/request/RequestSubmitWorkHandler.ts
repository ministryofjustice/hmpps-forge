import type { CompiledSubmitHookResult } from '../../../contracts/runtime/hookLifecycle.type'
import { buildCompiledHookLifecycleContext } from '../context/compiledEvaluationContext'
import { SUBMIT_LIFECYCLE_KIND } from '../phases/hooks/SubmitLifecycleWorkHandler'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/runtime/work.type'
import { singleChildOutput } from '../work/workTask'
import { phaseInstrumentation, runTaskPhase } from './requestPhase'
import type { RequestSubmitWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type { PhaseWorkOutput, RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'
import ForgeInternalError from '../../../errors/ForgeInternalError'

export const REQUEST_SUBMIT_KIND = 'request.submit'

export const REQUEST_SUBMIT_WORK_INSTRUMENTATION: WorkInstrumentation<RequestSubmitWorkProps, PhaseWorkOutput> =
  phaseInstrumentation()

/**
 * The submit phase as work (POST steps only). `begin` runs the compiled submit
 * lifecycle (its validation runs as nested `submit.validation` work, which reads
 * the hoisted validation builder off the threaded context); `complete` maps the
 * hook result to a halt or continue and surfaces validation state for render.
 */
export const REQUEST_SUBMIT_WORK_HANDLER: WorkHandler<'request.submit', RequestSubmitWorkProps> = {
  kind: REQUEST_SUBMIT_KIND,

  async begin(ctx: WorkContextContract<RequestExecutionContext, RequestSubmitWorkProps>) {
    const hookLifecycleContext = buildCompiledHookLifecycleContext(
      ctx.request.context,
      ctx.request.functionRegistry,
      'submit',
      ctx.request.responseBindings,
    )

    return runTaskPhase(
      ctx.props.compiled(hookLifecycleContext),
      SUBMIT_LIFECYCLE_KIND,
      'Compiled submit hooks returned an invalid work task',
    )
  },

  complete(
    ctx: WorkContextContract<RequestExecutionContext, RequestSubmitWorkProps>,
    children: readonly CompletedWork[],
  ): PhaseWorkOutput {
    const result = singleChildOutput(children, SUBMIT_LIFECYCLE_KIND)

    if (result === undefined) {
      throw new ForgeInternalError('Submit lifecycle work task completed with an invalid submit result')
    }

    const output = toOutput(ctx, result)

    return output
  },
}

function toOutput(
  ctx: WorkContextContract<RequestExecutionContext>,
  result: CompiledSubmitHookResult,
): PhaseWorkOutput {
  if (result.outcome === 'redirect') {
    if (result.redirect === undefined) {
      throw new ForgeInternalError('Hook redirect target is missing')
    }

    return { action: 'halt-redirect', target: result.redirect, reason: 'submit' }
  }

  if (result.outcome === 'error') {
    return { action: 'halt-error', status: result.status ?? 500, message: result.message || 'Submission error' }
  }

  ctx.request.showValidationFailures = result.validated

  return { action: 'continue' }
}
