import { buildCompiledRouteMetadataContext } from '../context/compiledEvaluationContext'
import { hydrateRouteTree } from '../phases/route-tree/hydrateRouteTree'
import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../../contracts/runtime/work.type'
import { phaseInstrumentation } from './requestPhase'
import type { RequestRouteTreeWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type { PhaseWorkOutput, RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'

const REQUEST_ROUTE_TREE_KIND = 'request.route-tree'

export const REQUEST_ROUTE_TREE_WORK_INSTRUMENTATION: WorkInstrumentation<RequestRouteTreeWorkProps, PhaseWorkOutput> =
  phaseInstrumentation()

/**
 * The route-tree phase (step requests only). Runs just before resolve. It
 * evaluates the package-level route-metadata function and merges the resolved
 * title/description/metadata onto the statically built topology, publishing the
 * hydrated tree on `ctx.request.routeTree` for resolve to assemble into the render
 * context. Always continues — building the tree is preparation, never a redirect.
 */
export const REQUEST_ROUTE_TREE_WORK_HANDLER: WorkHandler<'request.route-tree', RequestRouteTreeWorkProps> = {
  kind: REQUEST_ROUTE_TREE_KIND,

  begin() {
    return { groups: [] }
  },

  async complete(
    ctx: WorkContextContract<RequestExecutionContext, RequestRouteTreeWorkProps>,
  ): Promise<PhaseWorkOutput> {
    const routeMetadata = await ctx.props.compiled(
      buildCompiledRouteMetadataContext(ctx.request.context, ctx.request.functionRegistry),
    )

    ctx.request.routeTree = hydrateRouteTree(
      ctx.props.routeTree,
      ctx.props.currentRouteTemplatePath,
      ctx.request.context.request.params,
      routeMetadata,
    )

    return { action: 'continue' }
  },
}
