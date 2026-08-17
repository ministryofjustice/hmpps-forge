import type { CompiledSubmitHookResult } from '../contracts/hookLifecycle.type'
import { buildCompiledHookLifecycleContext } from '../../../runtime/context/compiledEvaluationContext'
import { SUBMIT_LIFECYCLE_KIND } from './SubmitLifecycleWorkHandler'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/work/work.type'
import { createWorkTask, isWorkTaskOfKind, singleChildOutput, singleTaskGroup } from '../../../work/workTask'
import { phaseInstrumentation } from '../../../runtime/pipeline/contextSnapshot'
import type { RequestSubmitWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type RequestState from '../../../runtime/pipeline/RequestState'
import type { PhaseWorkOutput } from '../../../contracts/runtime/requestPipelineOutput.type'
import ForgeInternalError from '../../../errors/ForgeInternalError'

const REQUEST_SUBMIT_KIND = 'request.submit'

export const REQUEST_SUBMIT_WORK_INSTRUMENTATION: WorkInstrumentation<RequestSubmitWorkProps, PhaseWorkOutput> =
  phaseInstrumentation()

/**
 * The submit phase as work (POST steps only). `begin` runs the compiled submit
 * lifecycle (its validation stage is the validation-owned `validation.current-step`
 * task, which owns execution, result storage, and the display signal); `complete`
 * maps the hook result to a halt or continue — submit outcomes only, never
 * validation display state.
 */
export const REQUEST_SUBMIT_WORK_HANDLER: WorkHandler<'request.submit', RequestSubmitWorkProps> = {
  kind: REQUEST_SUBMIT_KIND,

  async begin(ctx: WorkContextContract<RequestState, RequestSubmitWorkProps>) {
    const hookLifecycleContext = buildCompiledHookLifecycleContext(
      ctx.state.context,
      ctx.state.dependencies.functionRegistry,
      'submit',
      ctx.state.dependencies.responseBindings,
    )

    const resolved = await ctx.props.compiled(hookLifecycleContext)

    if (!isWorkTaskOfKind(resolved, SUBMIT_LIFECYCLE_KIND)) {
      throw new ForgeInternalError('Compiled submit hooks returned an invalid work task')
    }

    return singleTaskGroup(resolved)
  },

  complete(
    _ctx: WorkContextContract<RequestState, RequestSubmitWorkProps>,
    children: readonly CompletedWork[],
  ): PhaseWorkOutput {
    const result = singleChildOutput(children, SUBMIT_LIFECYCLE_KIND)

    if (result === undefined) {
      throw new ForgeInternalError('Submit lifecycle work task completed with an invalid submit result')
    }

    return toOutput(result)
  },
}

function toOutput(result: CompiledSubmitHookResult): PhaseWorkOutput {
  if (result.outcome === 'redirect') {
    if (result.redirect === undefined) {
      throw new ForgeInternalError('Hook redirect target is missing')
    }

    return { action: 'halt-redirect', target: result.redirect, reason: 'submit' }
  }

  if (result.outcome === 'error') {
    return { action: 'halt-error', status: result.status ?? 500, message: result.message || 'Submission error' }
  }

  return { action: 'continue' }
}

export function createRequestSubmitTask(props: RequestSubmitWorkProps) {
  return createWorkTask('submit', REQUEST_SUBMIT_WORK_HANDLER, props, REQUEST_SUBMIT_WORK_INSTRUMENTATION)
}
