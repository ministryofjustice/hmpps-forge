import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/runtime/work.type'
import { singleChildOutput } from '../work/workTask'
import { phaseInstrumentation } from './requestPhase'
import { RENDER_ASSEMBLE_PAGE_KIND } from '../phases/render/RenderAssemblePageWorkHandler'
import WorkTaskFactory from '../work/WorkTaskFactory'
import type { RequestRenderWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type { PhaseWorkOutput, RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'
import ForgeInternalError from '../../../errors/ForgeInternalError'

const REQUEST_RENDER_KIND = 'request.render'

export const REQUEST_RENDER_WORK_INSTRUMENTATION: WorkInstrumentation<RequestRenderWorkProps, PhaseWorkOutput> =
  phaseInstrumentation()

export const REQUEST_RENDER_WORK_HANDLER: WorkHandler<'request.render', RequestRenderWorkProps> = {
  kind: REQUEST_RENDER_KIND,

  begin(ctx: WorkContextContract<RequestExecutionContext, RequestRenderWorkProps>) {
    const renderContext = ctx.request.renderContext

    if (!renderContext) {
      throw new ForgeInternalError('Render phase reached without a render context — resolve phase did not produce one')
    }

    const { renderer, componentRegistry } = ctx.props

    const renderBlocks = WorkTaskFactory.renderBlocks(renderContext.blocks, renderer, componentRegistry)
    const assemblePage = WorkTaskFactory.assemblePage(renderContext, renderer)

    return {
      groups: [
        { mode: 'sequential' as const, children: [renderBlocks] },
        { mode: 'sequential' as const, children: [assemblePage] },
      ],
    }
  },

  complete(
    ctx: WorkContextContract<RequestExecutionContext, RequestRenderWorkProps>,
    children: readonly CompletedWork[],
  ): PhaseWorkOutput {
    const renderContext = ctx.request.renderContext!
    const output = singleChildOutput(children, RENDER_ASSEMBLE_PAGE_KIND)

    return { action: 'render', renderContext, output }
  },
}
