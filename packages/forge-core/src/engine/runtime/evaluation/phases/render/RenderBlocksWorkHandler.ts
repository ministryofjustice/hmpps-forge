import type { RenderBlock, ForgeRenderer } from '../../../../../framework/types/rendering.type'
import type { ComponentRegistry } from '../../../../../framework/types/adapter.type'
import type { ComponentRegistryEntry } from '../../../../../components/types/components.type'
import type { BlockDefinition } from '../../../../../components/types/structures.type'
import type { RequestExecutionContext } from '../../../../contracts/runtime/RequestExecutionContext.type'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../../contracts/runtime/work.type'
import type { TraceSpanFields } from '../../../../diagnostics/tracing/traceSpan.type'
import ForgeUnregisteredComponentError from '../../../../errors/ForgeUnregisteredComponentError'
import { childOutputs } from '../../work/workTask'
import { RENDER_BLOCK_KIND } from './RenderBlockWorkHandler'
import WorkTaskFactory from '../../work/WorkTaskFactory'

export interface RenderBlocksWorkProps {
  readonly blocks: readonly RenderBlock[]
  readonly renderer: ForgeRenderer<unknown>
  readonly componentRegistry: ComponentRegistry
}

const RENDER_BLOCKS_KIND = 'render.render-blocks'

export const RENDER_BLOCKS_WORK_INSTRUMENTATION: WorkInstrumentation<RenderBlocksWorkProps, unknown> = {
  resolveTraceMetadataAtStart(
    ctx: WorkContextContract<RequestExecutionContext, RenderBlocksWorkProps>,
  ): TraceSpanFields {
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

  begin(ctx: WorkContextContract<RequestExecutionContext, RenderBlocksWorkProps>) {
    const { blocks, renderer, componentRegistry } = ctx.props

    const children = blocks.map(block =>
      WorkTaskFactory.renderBlock(
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

  complete(
    ctx: WorkContextContract<RequestExecutionContext, RenderBlocksWorkProps>,
    children: readonly CompletedWork[],
  ) {
    const renderedBlocks = childOutputs(children, RENDER_BLOCK_KIND)

    ctx.request.renderedBlocks = renderedBlocks

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
