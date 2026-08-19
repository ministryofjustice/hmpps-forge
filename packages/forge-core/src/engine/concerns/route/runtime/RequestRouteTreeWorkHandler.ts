import { buildCompiledRouteMetadataContext } from '../../../runtime/context/compiledEvaluationContext'
import { hydrateRouteTree } from './hydrateRouteTree'
import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../../contracts/work/work.type'
import { createWorkTask } from '../../../work/workTask'
import { phaseInstrumentation } from '../../../runtime/pipeline/contextSnapshot'
import type { RequestRouteTreeWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type RequestState from '../../../runtime/pipeline/RequestState'
import type { PhaseWorkOutput } from '../../../contracts/runtime/requestPipelineOutput.type'

const REQUEST_ROUTE_TREE_KIND = 'request.route-tree'

export const REQUEST_ROUTE_TREE_WORK_INSTRUMENTATION: WorkInstrumentation<RequestRouteTreeWorkProps, PhaseWorkOutput> =
  phaseInstrumentation()

/**
 * The route-tree phase (step requests only). Runs just before resolve. It
 * evaluates the package-level route-metadata function and merges the resolved
 * title/description/metadata onto the statically built topology, publishing the
 * hydrated tree on `ctx.state.routeTree` for resolve to assemble into the render
 * context. Always continues — building the tree is preparation, never a redirect.
 */
export const REQUEST_ROUTE_TREE_WORK_HANDLER: WorkHandler<'request.route-tree', RequestRouteTreeWorkProps> = {
  kind: REQUEST_ROUTE_TREE_KIND,

  begin() {
    return { groups: [] }
  },

  async complete(ctx: WorkContextContract<RequestState, RequestRouteTreeWorkProps>): Promise<PhaseWorkOutput> {
    const routeMetadata = await ctx.props.compiled(
      buildCompiledRouteMetadataContext(ctx.state.context, ctx.state.dependencies.functionRegistry),
    )

    ctx.state.recordRouteTree(
      hydrateRouteTree(
        ctx.props.routeTree,
        ctx.props.currentRouteTemplatePath,
        ctx.state.context.request.params,
        routeMetadata,
      ),
    )

    return { action: 'continue' }
  },
}

export function createRequestRouteTreeTask(props: RequestRouteTreeWorkProps) {
  return createWorkTask('route-tree', REQUEST_ROUTE_TREE_WORK_HANDLER, props, REQUEST_ROUTE_TREE_WORK_INSTRUMENTATION)
}
