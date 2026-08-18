import type { ComponentRegistryEntry } from '../../../../components/types/components.type'
import type { BlockDefinition, EvaluatedBlock } from '../../../../components/types/structures.type'
import { StructureType } from '../../../../authoring/types/enums'
import { RENDER_BLOCK_BRAND } from '../contracts/renderBlock.brand'
import type { RenderBlock, ForgeRenderer } from '../../../../framework/types/rendering.type'
import type { ComponentRegistry } from '../../../../framework/types/adapter.type'
import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
  WorkTask,
} from '../../../chassis/contracts/work/work.type'
import type { TraceSpanFields } from '../../../chassis/tracing/traceSpan.type'
import ForgeUnregisteredComponentError from '../../../errors/ForgeUnregisteredComponentError'
import { createWorkTask } from '../../../chassis/work/workTask'

export interface RenderBlockWorkProps {
  readonly block: RenderBlock
  readonly entry: ComponentRegistryEntry<BlockDefinition, unknown>
  readonly renderer: ForgeRenderer<unknown>
  readonly componentRegistry: ComponentRegistry
}

type RenderBlockWorkTask = WorkTask<'render.render-blocks.block', RenderBlockWorkProps>

export const RENDER_BLOCK_KIND = 'render.render-blocks.block'

export const RENDER_BLOCK_WORK_INSTRUMENTATION: WorkInstrumentation<RenderBlockWorkProps, unknown> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestState, RenderBlockWorkProps>): TraceSpanFields {
    return {
      id: ctx.props.block.id,
      variant: ctx.props.block.variant,
      blockType: ctx.props.block.blockType,
    }
  },

  resolveTraceMetadataAtFinish(): TraceSpanFields | undefined {
    return undefined
  },
}

export const RENDER_BLOCK_WORK_HANDLER: WorkHandler<'render.render-blocks.block', RenderBlockWorkProps> = {
  kind: RENDER_BLOCK_KIND,

  begin(ctx: WorkContextContract<RequestState, RenderBlockWorkProps>) {
    const { block, renderer, componentRegistry } = ctx.props

    if (block.properties.visibleWhen === false) {
      ctx.omitFromTrace?.()

      return { output: '' }
    }

    const nestedTasks = collectNestedBlockTasks(block.properties, renderer, componentRegistry)

    if (nestedTasks.length === 0) {
      return { groups: [] }
    }

    return {
      groups: [
        {
          mode: 'concurrent' as const,
          children: nestedTasks,
        },
      ],
    }
  },

  async complete(ctx: WorkContextContract<RequestState, RenderBlockWorkProps>, children: readonly CompletedWork[]) {
    const { block, entry, renderer } = ctx.props

    if (block.properties.visibleWhen === false) {
      return ''
    }

    const updatedProperties = replaceNestedBlocks(block.properties, children, renderer)
    const evaluatedBlock = toEvaluatedBlock({ ...block, properties: updatedProperties })

    const output = await renderer.renderBlock(entry, evaluatedBlock)

    // Mark only while devtools is tracing, so production output stays unmarked.
    if (ctx.state.dependencies.traceEnabled && renderer.markBlock) {
      return renderer.markBlock(block.id, output)
    }

    return output
  },
}

function toEvaluatedBlock(block: RenderBlock): EvaluatedBlock<BlockDefinition> {
  return {
    type: StructureType.BLOCK,
    variant: block.variant,
    blockType: block.blockType,
    ...block.properties,
  } as EvaluatedBlock<BlockDefinition>
}

function isRenderBlock(value: unknown): value is RenderBlock {
  return typeof value === 'object' &&
    value !== null &&
    RENDER_BLOCK_BRAND in value &&
    (value as Record<symbol, unknown>)[RENDER_BLOCK_BRAND] === true
}

function collectNestedBlockTasks(
  properties: Record<string, unknown>,
  renderer: ForgeRenderer<unknown>,
  componentRegistry: ComponentRegistry,
): RenderBlockWorkTask[] {
  const tasks: RenderBlockWorkTask[] = []

  walkProperties(properties, value => {
    if (!isRenderBlock(value)) {
      return
    }

    const entry = componentRegistry.get(value.variant)

    if (entry === undefined) {
      throw new ForgeUnregisteredComponentError({ variant: value.variant })
    }

    tasks.push(createRenderBlockTask(value.id, value, entry, renderer, componentRegistry))
  })

  return tasks
}

function replaceNestedBlocks(
  properties: Record<string, unknown>,
  children: readonly CompletedWork[],
  renderer: ForgeRenderer<unknown>,
): Record<string, unknown> {
  let childIndex = 0

  return replaceInValue(properties, value => {
    if (!isRenderBlock(value)) {
      return value
    }

    const blockDefinition = {
      type: StructureType.BLOCK,
      variant: value.variant,
      blockType: value.blockType,
      ...value.properties,
    } as BlockDefinition

    const entry = children[childIndex]

    if (!entry) {
      return value
    }

    childIndex += 1

    return renderer.wrapNestedBlock(blockDefinition, entry.output)
  }) as Record<string, unknown>
}

function walkProperties(value: unknown, visitor: (value: unknown) => void): void {
  if (value === undefined || value === null || typeof value !== 'object') {
    return
  }

  if (isRenderBlock(value)) {
    visitor(value)

    return
  }

  if (Array.isArray(value)) {
    value.forEach(item => walkProperties(item, visitor))

    return
  }

  Object.values(value).forEach(item => walkProperties(item, visitor))
}

function replaceInValue(value: unknown, replacer: (value: unknown) => unknown): unknown {
  if (value === undefined || value === null || typeof value !== 'object') {
    return value
  }

  if (isRenderBlock(value)) {
    return replacer(value)
  }

  if (Array.isArray(value)) {
    return value.map(item => replaceInValue(item, replacer))
  }

  const result: Record<string, unknown> = {}

  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    result[key] = replaceInValue(item, replacer)
  })

  return result
}

export function createRenderBlockTask(
  id: string,
  block: RenderBlock,
  entry: ComponentRegistryEntry<BlockDefinition, unknown>,
  renderer: ForgeRenderer<unknown>,
  componentRegistry: ComponentRegistry,
) {
  return createWorkTask(
    id,
    RENDER_BLOCK_WORK_HANDLER,
    { block, entry, renderer, componentRegistry },
    RENDER_BLOCK_WORK_INSTRUMENTATION,
  )
}
