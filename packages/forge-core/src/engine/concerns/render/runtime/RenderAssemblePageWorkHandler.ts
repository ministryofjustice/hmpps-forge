import type { RenderContext, ForgeRenderer } from '../../../../framework/types/rendering.type'
import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../chassis/contracts/work/work.type'
import type { TraceSpanFields } from '../../../chassis/tracing/traceSpan.type'
import { createWorkTask, singleChildOutput, singleTaskGroup } from '../../../chassis/work/workTask'
import ForgeUnregisteredComponentError from '../../../errors/ForgeUnregisteredComponentError'
import ForgeInternalError from '../../../errors/ForgeInternalError'
import { FunctionEntryType } from '../../../../shared/taxonomy'
import { createRenderBlockTask, RENDER_BLOCK_KIND } from './RenderBlockWorkHandler'

export interface RenderAssemblePageWorkProps {
  readonly renderContext: RenderContext
  readonly renderer: ForgeRenderer<unknown>
}

export const RENDER_ASSEMBLE_PAGE_KIND = 'render.assemble-page'

export const RENDER_ASSEMBLE_PAGE_WORK_INSTRUMENTATION: WorkInstrumentation<RenderAssemblePageWorkProps, unknown> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestState, RenderAssemblePageWorkProps>): TraceSpanFields {
    return {
      renderedBlocks: (ctx.state.renderedBlocks ?? []).length,
      ...(ctx.props.renderContext.renderer === undefined
        ? {}
        : {
            id: ctx.props.renderContext.renderer.id,
            variant: ctx.props.renderContext.renderer.variant,
          }),
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
    const renderedBlockShape = ctx.state.renderedBlockShape

    if (renderContext.renderer === undefined) {
      throw new ForgeInternalError('Step render work started without a step renderer')
    }

    const rendererInvocation = renderContext.renderer
    const entry = ctx.state.functionRegistry.get(rendererInvocation.variant)

    if (entry === undefined) {
      throw new ForgeUnregisteredComponentError({ variant: rendererInvocation.variant })
    }

    if (entry._forge !== FunctionEntryType.RENDERER) {
      throw new ForgeInternalError(`Step renderer "${rendererInvocation.variant}" was not declared with renderer()`)
    }

    const rendererFunctionContext = {
      kind: 'step' as const,
      step: renderContext.step,
      ancestors: renderContext.ancestors,
      routeTree: renderContext.routeTree,
      showValidationFailures: renderContext.showValidationFailures,
      fieldValidationErrors: renderContext.fieldValidationErrors,
      domainValidationErrors: renderContext.domainValidationErrors,
      answers: renderContext.answers,
      data: renderContext.data,
    }

    return singleTaskGroup(
      createRenderBlockTask(
        String(rendererInvocation.id),
        rendererInvocation,
        renderer,
        rendererFunctionContext,
        renderedBlockShape,
      ),
    )
  },

  complete(_ctx: WorkContextContract<RequestState, RenderAssemblePageWorkProps>, children: readonly CompletedWork[]) {
    const output = singleChildOutput(children, RENDER_BLOCK_KIND)

    if (output === undefined) {
      throw new ForgeInternalError('Step renderer completed without an output')
    }

    return output
  },
}

const DEFAULT_RENDER_ASSEMBLE_PAGE_WORK_HANDLER: WorkHandler<'render.assemble-page', RenderAssemblePageWorkProps> = {
  kind: RENDER_ASSEMBLE_PAGE_KIND,

  async begin(ctx: WorkContextContract<RequestState, RenderAssemblePageWorkProps>) {
    const { renderContext, renderer } = ctx.props
    const renderedBlocks = ctx.state.renderedBlocks ?? []
    const requestState = ctx.state.context.request.state
    const output = await renderer.assemblePage(renderContext, renderedBlocks, requestState)

    return { output }
  },
}

export function createAssemblePageTask(renderContext: RenderContext, renderer: ForgeRenderer<unknown>) {
  const handler =
    renderContext.renderer === undefined ? DEFAULT_RENDER_ASSEMBLE_PAGE_WORK_HANDLER : RENDER_ASSEMBLE_PAGE_WORK_HANDLER

  return createWorkTask(
    'assemble-page',
    handler,
    { renderContext, renderer },
    RENDER_ASSEMBLE_PAGE_WORK_INSTRUMENTATION,
  )
}
