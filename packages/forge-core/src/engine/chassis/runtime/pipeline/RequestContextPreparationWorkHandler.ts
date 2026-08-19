import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../contracts/work/work.type'
import { phaseInstrumentation } from './contextSnapshot'
import { createWorkTask } from '../../work/workTask'
import type { RequestContextPreparationWorkProps } from '../../contracts/runtime/RequestPipelineWork.type'
import type RequestState from './RequestState'
import type { PhaseWorkOutput } from '../../contracts/runtime/requestPipelineOutput.type'

const REQUEST_CONTEXT_PREPARATION_KIND = 'request.context-preparation'

export const REQUEST_CONTEXT_PREPARATION_WORK_INSTRUMENTATION: WorkInstrumentation<
  RequestContextPreparationWorkProps,
  PhaseWorkOutput
> = phaseInstrumentation()

export const REQUEST_CONTEXT_PREPARATION_WORK_HANDLER: WorkHandler<
  'request.context-preparation',
  RequestContextPreparationWorkProps
> = {
  kind: REQUEST_CONTEXT_PREPARATION_KIND,

  begin(ctx: WorkContextContract<RequestState, RequestContextPreparationWorkProps>) {
    const context = ctx.state.context
    const snapshot = ctx.props.snapshot
    const staticData = ctx.props.compiledStaticData()

    Object.assign(context.domain.data, staticData)

    context.request = {
      url: snapshot.location.href,
      path: snapshot.location.pathname,
      method: snapshot.method,
      location: snapshot.location,
      headers: snapshot.headers,
      cookies: snapshot.cookies,
      state: snapshot.state,
      params: snapshot.params,
      query: snapshot.query,
      post: snapshot.post,
      session: (snapshot.session ?? {}) as Record<string, unknown>,
    }

    return { output: { action: 'continue' as const } }
  },
}

export function createRequestContextPreparationTask(props: RequestContextPreparationWorkProps) {
  return createWorkTask(
    'context-preparation',
    REQUEST_CONTEXT_PREPARATION_WORK_HANDLER,
    props,
    REQUEST_CONTEXT_PREPARATION_WORK_INSTRUMENTATION,
  )
}
