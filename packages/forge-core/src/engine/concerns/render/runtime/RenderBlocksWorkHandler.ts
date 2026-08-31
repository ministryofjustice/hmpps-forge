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
import { RENDER_BLOCK_KIND, createRenderBlockTask, toBlockDefinition } from './RenderBlockWorkHandler'
import WorkTaskPropsWalker from '../../../chassis/work/WorkTaskPropsWalker'
import { RENDER_BLOCK_BRAND } from '../contracts/renderBlock.brand'

export interface RenderBlocksWorkProps {
  readonly blocks: unknown
  readonly renderer: ForgeRenderer<unknown>
  readonly reconstructBlockShape: boolean
}

const RENDER_BLOCKS_KIND = 'render.render-blocks'

const propsWalker = new WorkTaskPropsWalker()

export const RENDER_BLOCKS_WORK_INSTRUMENTATION: WorkInstrumentation<RenderBlocksWorkProps, unknown> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestState, RenderBlocksWorkProps>): TraceSpanFields {
    return {
      blocks: collectRenderBlocks(ctx.props.blocks).length,
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
    const renderTaskShape = createRenderTaskShape(blocks, renderer)
    const children = propsWalker.collect(renderTaskShape)

    return {
      groups: [
        {
          mode: 'concurrent' as const,
          children,
        },
      ],
    }
  },

  async complete(ctx: WorkContextContract<RequestState, RenderBlocksWorkProps>, children: readonly CompletedWork[]) {
    const blocks = collectRenderBlocks(ctx.props.blocks)
    const renderedBlocks = childOutputs(children, RENDER_BLOCK_KIND)

    ctx.state.recordRenderedBlocks(renderedBlocks)

    if (!ctx.props.reconstructBlockShape) {
      return renderedBlocks
    }

    const wrappedBlocks = await Promise.all(
      blocks.map((block, index) => ctx.props.renderer.wrapNestedBlock(toBlockDefinition(block), renderedBlocks[index])),
    )
    const wrappedChildren = children.map((child, index) => ({ ...child, output: wrappedBlocks[index] }))
    const renderedBlockShape = propsWalker.replaceCompletedOutputs(
      createRenderTaskShape(ctx.props.blocks, ctx.props.renderer),
      wrappedChildren,
    )

    ctx.state.recordRenderedBlockShape(renderedBlockShape)

    return renderedBlocks
  },
}

export function createRenderBlocksTask(
  blocks: unknown,
  renderer: ForgeRenderer<unknown>,
  reconstructBlockShape = false,
) {
  return createWorkTask(
    'render-blocks',
    RENDER_BLOCKS_WORK_HANDLER,
    { blocks, renderer, reconstructBlockShape },
    RENDER_BLOCKS_WORK_INSTRUMENTATION,
  )
}

function collectRenderBlocks(value: unknown): readonly RenderBlock[] {
  const blocks: RenderBlock[] = []

  walkBlockShape(value, block => {
    blocks.push(block)

    return block
  })

  return blocks
}

function createRenderTaskShape(value: unknown, renderer: ForgeRenderer<unknown>): unknown {
  return walkBlockShape(value, block => createRenderBlockTask(String(block.id), block, renderer))
}

function walkBlockShape(value: unknown, replaceBlock: (block: RenderBlock) => unknown): unknown {
  if (isRenderBlock(value)) {
    return replaceBlock(value)
  }

  if (Array.isArray(value)) {
    return value.map(item => walkBlockShape(item, replaceBlock))
  }

  if (!isPlainRecord(value)) {
    return value
  }

  const result: Record<PropertyKey, unknown> = {}

  Reflect.ownKeys(value)
    .filter(key => Object.prototype.propertyIsEnumerable.call(value, key))
    .forEach(key => {
      result[key] = walkBlockShape(value[key], replaceBlock)
    })

  return result
}

function isPlainRecord(value: unknown): value is Record<PropertyKey, unknown> {
  if (value === undefined || value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)

  return prototype === Object.prototype || prototype === null
}

function isRenderBlock(value: unknown): value is RenderBlock {
  return value !== null && typeof value === 'object' && RENDER_BLOCK_BRAND in value
}
