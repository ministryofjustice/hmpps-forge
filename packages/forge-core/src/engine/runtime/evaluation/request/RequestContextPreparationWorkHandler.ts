import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../../contracts/runtime/work.type'
import { phaseInstrumentation } from './requestPhase'
import type { RequestContextPreparationWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type { PhaseWorkOutput, RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'

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

  begin(ctx: WorkContextContract<RequestExecutionContext, RequestContextPreparationWorkProps>) {
    const context = ctx.request.context
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
