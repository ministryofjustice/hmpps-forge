import type { RenderContext, ForgeRenderer } from '../../../../framework/types/rendering.type'
import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../../chassis/contracts/work/work.type'
import type { TraceSpanFields } from '../../../chassis/tracing/traceSpan.type'
import { createWorkTask } from '../../../chassis/work/workTask'

export interface RenderAssemblePageWorkProps {
  readonly renderContext: RenderContext
  readonly renderer: ForgeRenderer<unknown>
}

export const RENDER_ASSEMBLE_PAGE_KIND = 'render.assemble-page'

export const RENDER_ASSEMBLE_PAGE_WORK_INSTRUMENTATION: WorkInstrumentation<RenderAssemblePageWorkProps, unknown> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestState, RenderAssemblePageWorkProps>): TraceSpanFields {
    return {
      renderedBlocks: (ctx.state.renderedBlocks ?? []).length,
    }
  },

  resolveTraceMetadataAtFinish(): TraceSpanFields | undefined {
    return undefined
  },
}

export const RENDER_ASSEMBLE_PAGE_WORK_HANDLER: WorkHandler<'render.assemble-page', RenderAssemblePageWorkProps> = {
  kind: RENDER_ASSEMBLE_PAGE_KIND,

  begin(ctx: WorkContextContract<RequestState, RenderAssemblePageWorkProps>) {
    const { renderContext, renderer } = ctx.props
    const renderedBlocks = ctx.state.renderedBlocks ?? []
    const requestState = ctx.state.context.request.state

    const output = renderer.assemblePage(renderContext, renderedBlocks, requestState)

    return { output: output as Promise<unknown> }
  },
}

export function createAssemblePageTask(renderContext: RenderContext, renderer: ForgeRenderer<unknown>) {
  return createWorkTask(
    'assemble-page',
    RENDER_ASSEMBLE_PAGE_WORK_HANDLER,
    { renderContext, renderer },
    RENDER_ASSEMBLE_PAGE_WORK_INSTRUMENTATION,
  )
}
