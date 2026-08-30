import type { RenderBlock, ForgeRenderer } from '../../../../framework/types/rendering.type'
import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../chassis/contracts/work/work.type'
import type { TraceSpanFields } from '../../../chassis/tracing/traceSpan.type'
import { childOutputs, createWorkTask } from '../../../chassis/work/workTask'
import { RENDER_BLOCK_KIND, createRenderBlockTask } from './RenderBlockWorkHandler'

export interface RenderBlocksWorkProps {
  readonly blocks: readonly RenderBlock[]
  readonly renderer: ForgeRenderer<unknown>
}

const RENDER_BLOCKS_KIND = 'render.render-blocks'

export const RENDER_BLOCKS_WORK_INSTRUMENTATION: WorkInstrumentation<RenderBlocksWorkProps, unknown> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestState, RenderBlocksWorkProps>): TraceSpanFields {
    return {
      blocks: ctx.props.blocks.length,
    }
  },

  resolveTraceMetadataAtFinish(): TraceSpanFields | undefined {
    return undefined
  },
}

export const RENDER_BLOCKS_WORK_HANDLER: WorkHandler<'render.render-blocks', RenderBlocksWorkProps> = {
  kind: RENDER_BLOCKS_KIND,

  begin(ctx: WorkContextContract<RequestState, RenderBlocksWorkProps>) {
    const { blocks, renderer } = ctx.props

    const children = blocks.map(block => createRenderBlockTask(block.id, block, renderer))

    return {
      groups: [
        {
          mode: 'concurrent' as const,
          children,
        },
      ],
    }
  },

  complete(ctx: WorkContextContract<RequestState, RenderBlocksWorkProps>, children: readonly CompletedWork[]) {
    const renderedBlocks = childOutputs(children, RENDER_BLOCK_KIND)

    ctx.state.recordRenderedBlocks(renderedBlocks)

    return renderedBlocks
  },
}

export function createRenderBlocksTask(blocks: readonly RenderBlock[], renderer: ForgeRenderer<unknown>) {
  return createWorkTask(
    'render-blocks',
    RENDER_BLOCKS_WORK_HANDLER,
    { blocks, renderer },
    RENDER_BLOCKS_WORK_INSTRUMENTATION,
  )
}
