import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/work/work.type'
import { createWorkTask, singleChildOutput } from '../../../work/workTask'
import { phaseInstrumentation } from '../../../runtime/pipeline/contextSnapshot'
import { RENDER_ASSEMBLE_PAGE_KIND, createAssemblePageTask } from './RenderAssemblePageWorkHandler'
import { createRenderBlocksTask } from './RenderBlocksWorkHandler'
import type { RequestRenderWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type RequestState from '../../../runtime/pipeline/RequestState'
import type { PhaseWorkOutput } from '../../../contracts/runtime/requestPipelineOutput.type'

const REQUEST_RENDER_KIND = 'request.render'

export const REQUEST_RENDER_WORK_INSTRUMENTATION: WorkInstrumentation<RequestRenderWorkProps, PhaseWorkOutput> =
  phaseInstrumentation()

export const REQUEST_RENDER_WORK_HANDLER: WorkHandler<'request.render', RequestRenderWorkProps> = {
  kind: REQUEST_RENDER_KIND,

  begin(ctx: WorkContextContract<RequestState, RequestRenderWorkProps>) {
    const renderContext = ctx.state.renderContext
    const { renderer, componentRegistry } = ctx.props

    const renderBlocks = createRenderBlocksTask(renderContext.blocks, renderer, componentRegistry)
    const assemblePage = createAssemblePageTask(renderContext, renderer)

    return {
      groups: [
        { mode: 'sequential' as const, children: [renderBlocks] },
        { mode: 'sequential' as const, children: [assemblePage] },
      ],
    }
  },

  complete(
    ctx: WorkContextContract<RequestState, RequestRenderWorkProps>,
    children: readonly CompletedWork[],
  ): PhaseWorkOutput {
    const renderContext = ctx.state.renderContext
    const output = singleChildOutput(children, RENDER_ASSEMBLE_PAGE_KIND)

    return { action: 'render', renderContext, output }
  },
}

export function createRequestRenderTask(props: RequestRenderWorkProps) {
  return createWorkTask('render', REQUEST_RENDER_WORK_HANDLER, props, REQUEST_RENDER_WORK_INSTRUMENTATION)
}
