import type { RenderContext, ForgeRenderer } from '../../../../framework/types/rendering.type'
import type { RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'
import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../../contracts/runtime/work.type'
import type { TraceSpanFields } from '../../../diagnostics/tracing/traceSpan.type'

export interface RenderAssemblePageWorkProps {
  readonly renderContext: RenderContext
  readonly renderer: ForgeRenderer<unknown>
}

export const RENDER_ASSEMBLE_PAGE_KIND = 'render.assemble-page'

export const RENDER_ASSEMBLE_PAGE_WORK_INSTRUMENTATION: WorkInstrumentation<RenderAssemblePageWorkProps, unknown> = {
  resolveTraceMetadataAtStart(
    ctx: WorkContextContract<RequestExecutionContext, RenderAssemblePageWorkProps>,
  ): TraceSpanFields {
    return {
      renderedBlocks: (ctx.request.renderedBlocks ?? []).length,
    }
  },

  resolveTraceMetadataAtFinish(): TraceSpanFields | undefined {
    return undefined
  },
}

export const RENDER_ASSEMBLE_PAGE_WORK_HANDLER: WorkHandler<'render.assemble-page', RenderAssemblePageWorkProps> = {
  kind: RENDER_ASSEMBLE_PAGE_KIND,

  begin(ctx: WorkContextContract<RequestExecutionContext, RenderAssemblePageWorkProps>) {
    const { renderContext, renderer } = ctx.props
    const renderedBlocks = ctx.request.renderedBlocks ?? []
    const requestState = ctx.request.context.request.state

    const output = renderer.assemblePage(renderContext, renderedBlocks, requestState)

    return { output: output as Promise<unknown> }
  },
}
