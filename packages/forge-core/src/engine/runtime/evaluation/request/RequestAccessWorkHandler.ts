import type { CompiledAccessHookResult } from '../../../contracts/runtime/hookLifecycle.type'
import { buildCompiledHookLifecycleContext } from '../context/compiledEvaluationContext'
import { ACCESS_LIFECYCLE_KIND } from '../phases/hooks/AccessLifecycleWorkHandler'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/runtime/work.type'
import { singleChildOutput } from '../work/workTask'
import { phaseInstrumentation, runTaskPhase } from './requestPhase'
import type { RequestAccessWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type { PhaseWorkOutput, RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'
import ForgeInternalError from '../../../errors/ForgeInternalError'

const REQUEST_ACCESS_KIND = 'request.access'

export const REQUEST_ACCESS_WORK_INSTRUMENTATION: WorkInstrumentation<RequestAccessWorkProps, PhaseWorkOutput> =
  phaseInstrumentation()

/**
 * The access phase as work. `begin` builds the hook lifecycle context locally and
 * runs the compiled access task as its child; `complete` maps the access
 * result to a halt or continue.
 */
export const REQUEST_ACCESS_WORK_HANDLER: WorkHandler<'request.access', RequestAccessWorkProps> = {
  kind: REQUEST_ACCESS_KIND,

  async begin(ctx: WorkContextContract<RequestExecutionContext, RequestAccessWorkProps>) {
    const hookLifecycleContext = buildCompiledHookLifecycleContext(
      ctx.request.context,
      ctx.request.functionRegistry,
      'access',
      ctx.request.responseBindings,
    )

    return runTaskPhase(
      ctx.props.compiled(hookLifecycleContext),
      ACCESS_LIFECYCLE_KIND,
      'Compiled access lifecycle returned an invalid work task',
    )
  },

  complete(
    ctx: WorkContextContract<RequestExecutionContext, RequestAccessWorkProps>,
    children: readonly CompletedWork[],
  ): PhaseWorkOutput {
    const result = singleChildOutput(children, ACCESS_LIFECYCLE_KIND)

    if (result === undefined) {
      throw new ForgeInternalError('Access lifecycle work task completed with an invalid access result')
    }

    const output = toOutput(result)

    return output
  },
}

function toOutput(result: CompiledAccessHookResult): PhaseWorkOutput {
  if (result.outcome === 'redirect') {
    if (result.redirect === undefined) {
      throw new ForgeInternalError('Hook redirect target is missing')
    }

    return { action: 'halt-redirect', target: result.redirect, reason: 'access-lifecycle' }
  }

  if (result.outcome === 'error') {
    return { action: 'halt-error', status: result.status ?? 500, message: result.message || 'Access denied' }
  }

  return { action: 'continue' }
}
