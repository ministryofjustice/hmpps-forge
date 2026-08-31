import type { BlockDefinition } from '../../../../components/types/structures.type'
import { RENDER_BLOCK_BRAND } from '../contracts/renderBlock.brand'
import type { RenderBlock, ForgeRenderer } from '../../../../framework/types/rendering.type'
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
import type { RendererFunctionContext } from '../../../../components/types/renderFunctions.type'
import { FunctionEntryType } from '../../../../shared/taxonomy'
import type {
  FunctionRegistryEntry,
  PresentationFunctionRegistryEntry,
} from '../../../../authoring/types/functions.type'
import type FunctionRegistry from '../../../chassis/registries/FunctionRegistry'

export interface RenderBlockWorkProps {
  readonly block: RenderBlock
  readonly renderer: ForgeRenderer<unknown>
  readonly rendererFunctionContext?: RendererFunctionContext
  readonly rendererBlocks?: unknown
}

export type RenderBlockWorkTask = WorkTask<'render.render-blocks.block', RenderBlockWorkProps>

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
    const { block, renderer } = ctx.props

    if (block.properties.visibleWhen === false) {
      ctx.omitFromTrace?.()

      return { output: '' }
    }

    const nestedTasks = collectNestedBlockTasks(block.properties, renderer)

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
    const { block, renderer } = ctx.props

    if (block.properties.visibleWhen === false) {
      return ''
    }

    const updatedProperties = replaceNestedBlocks(block.properties, children, renderer)
    const entryType =
      ctx.props.rendererFunctionContext === undefined ? FunctionEntryType.COMPONENT : FunctionEntryType.RENDERER
    const entry = resolvePresentationFunction(ctx.state.functionRegistry, block.variant, entryType)
    const output =
      ctx.props.rendererFunctionContext === undefined
        ? await entry.evaluate(updatedProperties)
        : await entry.evaluate(ctx.props.rendererBlocks, updatedProperties, ctx.props.rendererFunctionContext)

    // Mark only while devtools is tracing, so production output stays unmarked.
    if (ctx.props.rendererFunctionContext === undefined && ctx.state.dependencies.traceEnabled && renderer.markBlock) {
      return renderer.markBlock(block.id, output)
    }

    return output
  },
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
): RenderBlockWorkTask[] {
  const tasks: RenderBlockWorkTask[] = []

  walkProperties(properties, value => {
    if (!isRenderBlock(value)) {
      return
    }

    tasks.push(createRenderBlockTask(value.id, value, renderer))
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

    const blockDefinition = toBlockDefinition(value)

    const entry = children[childIndex]

    if (!entry) {
      return value
    }

    childIndex += 1

    return renderer.wrapNestedBlock(blockDefinition, entry.output)
  }) as Record<string, unknown>
}

export function toBlockDefinition(block: RenderBlock): BlockDefinition {
  return {
    _forge: block.blockType,
    variant: block.variant,
    ...block.properties,
  } as BlockDefinition
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
  renderer: ForgeRenderer<unknown>,
  rendererFunctionContext?: RendererFunctionContext,
  rendererBlocks?: unknown,
) {
  return createWorkTask(
    id,
    RENDER_BLOCK_WORK_HANDLER,
    {
      block,
      renderer,
      ...(rendererFunctionContext === undefined ? {} : { rendererFunctionContext }),
      ...(rendererBlocks === undefined ? {} : { rendererBlocks }),
    },
    RENDER_BLOCK_WORK_INSTRUMENTATION,
  )
}

function resolvePresentationFunction(
  functionRegistry: FunctionRegistry,
  variant: string,
  entryType: FunctionEntryType.COMPONENT | FunctionEntryType.RENDERER,
): PresentationFunctionRegistryEntry {
  const renderEntry = functionRegistry.get(variant)

  if (isPresentationFunctionEntry(renderEntry) && renderEntry._forge === entryType) {
    return renderEntry
  }

  throw new ForgeUnregisteredComponentError({ variant })
}

function isPresentationFunctionEntry(
  entry: FunctionRegistryEntry | undefined,
): entry is PresentationFunctionRegistryEntry {
  return entry?._forge === FunctionEntryType.COMPONENT || entry?._forge === FunctionEntryType.RENDERER
}
