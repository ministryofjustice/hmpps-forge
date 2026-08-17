import type { CompiledAccessHookResult } from '../contracts/hookLifecycle.type'
import { buildCompiledHookLifecycleContext } from '../../../runtime/context/compiledEvaluationContext'
import { ACCESS_LIFECYCLE_KIND } from './AccessLifecycleWorkHandler'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/work/work.type'
import { createWorkTask, isWorkTaskOfKind, singleChildOutput, singleTaskGroup } from '../../../work/workTask'
import { phaseInstrumentation } from '../../../runtime/pipeline/contextSnapshot'
import type { RequestAccessWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type RequestState from '../../../runtime/pipeline/RequestState'
import type { PhaseWorkOutput } from '../../../contracts/runtime/requestPipelineOutput.type'
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

  async begin(ctx: WorkContextContract<RequestState, RequestAccessWorkProps>) {
    const hookLifecycleContext = buildCompiledHookLifecycleContext(
      ctx.state.context,
      ctx.state.dependencies.functionRegistry,
      'access',
      ctx.state.dependencies.responseBindings,
    )

    const resolved = await ctx.props.compiled(hookLifecycleContext)

    if (!isWorkTaskOfKind(resolved, ACCESS_LIFECYCLE_KIND)) {
      throw new ForgeInternalError('Compiled access lifecycle returned an invalid work task')
    }

    return singleTaskGroup(resolved)
  },

  complete(
    ctx: WorkContextContract<RequestState, RequestAccessWorkProps>,
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

export function createRequestAccessTask(props: RequestAccessWorkProps) {
  return createWorkTask('access', REQUEST_ACCESS_WORK_HANDLER, props, REQUEST_ACCESS_WORK_INSTRUMENTATION)
}
