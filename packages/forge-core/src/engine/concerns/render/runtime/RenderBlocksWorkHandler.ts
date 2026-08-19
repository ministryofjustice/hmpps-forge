import type { RenderBlock, ForgeRenderer } from '../../../../framework/types/rendering.type'
import type { ComponentRegistry } from '../../../../framework/types/adapter.type'
import type { ComponentRegistryEntry } from '../../../../components/types/components.type'
import type { BlockDefinition } from '../../../../components/types/structures.type'
import type RequestState from '../../../runtime/pipeline/RequestState'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/work/work.type'
import type { TraceSpanFields } from '../../../tracing/traceSpan.type'
import ForgeUnregisteredComponentError from '../../../errors/ForgeUnregisteredComponentError'
import { childOutputs, createWorkTask } from '../../../work/workTask'
import { RENDER_BLOCK_KIND, createRenderBlockTask } from './RenderBlockWorkHandler'

export interface RenderBlocksWorkProps {
  readonly blocks: readonly RenderBlock[]
  readonly renderer: ForgeRenderer<unknown>
  readonly componentRegistry: ComponentRegistry
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
    const { blocks, renderer, componentRegistry } = ctx.props

    const children = blocks.map(block =>
      createRenderBlockTask(
        block.id,
        block,
        resolveComponentEntry(componentRegistry, block.variant),
        renderer,
        componentRegistry,
      ),
    )

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

function resolveComponentEntry(
  componentRegistry: ComponentRegistry,
  variant: string,
): ComponentRegistryEntry<BlockDefinition, unknown> {
  const entry = componentRegistry.get(variant)

  if (entry === undefined) {
    throw new ForgeUnregisteredComponentError({ variant })
  }

  return entry
}

export function createRenderBlocksTask(
  blocks: readonly RenderBlock[],
  renderer: ForgeRenderer<unknown>,
  componentRegistry: ComponentRegistry,
) {
  return createWorkTask(
    'render-blocks',
    RENDER_BLOCKS_WORK_HANDLER,
    { blocks, renderer, componentRegistry },
    RENDER_BLOCKS_WORK_INSTRUMENTATION,
  )
}
