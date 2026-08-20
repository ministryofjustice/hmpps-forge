import type { CompiledResolveBlockWorkProps } from '../../../chassis/contracts/compiled/compiledFunctions.type'
import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type { NodeId } from '../../../chassis/contracts/ast/ast.type'
import type { BlockType } from '../../../../authoring/types/enums'
import { RENDER_BLOCK_BRAND } from '../../render/contracts/renderBlock.brand'
import type { RenderBlock } from '../../../../framework/types/rendering.type'
import WorkTaskPropsWalker from '../../../chassis/work/WorkTaskPropsWalker'
import { createWorkTask } from '../../../chassis/work/workTask'
import type {
  CompletedWork,
  WorkContextContract,
  WorkTask,
  WorkHandler,
  WorkInstrumentation,
} from '../../../chassis/contracts/work/work.type'
import type { TraceSpanFields } from '../../../chassis/tracing/traceSpan.type'
import ForgeInternalError from '../../../errors/ForgeInternalError'

export type ResolveBlockWorkProps = CompiledResolveBlockWorkProps

export type ResolveBlockWorkTask = WorkTask<'resolve.block', ResolveBlockWorkProps>

export const RESOLVE_BLOCK_KIND = 'resolve.block'

const propsWalker = new WorkTaskPropsWalker()

export const RESOLVE_BLOCK_WORK_INSTRUMENTATION: WorkInstrumentation<ResolveBlockWorkProps, RenderBlock> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestState, ResolveBlockWorkProps>) {
    return traceBegin(ctx.props)
  },

  resolveTraceMetadataAtFinish(_ctx, output) {
    return traceComplete(output)
  },
}

export const RESOLVE_BLOCK_WORK_HANDLER: WorkHandler<'resolve.block', ResolveBlockWorkProps> = {
  kind: RESOLVE_BLOCK_KIND,

  begin(ctx: WorkContextContract<RequestState, ResolveBlockWorkProps>) {
    const children = propsWalker.collect(ctx.props.properties)

    if (children.length === 0) {
      return { groups: [] }
    }

    return {
      groups: [
        {
          mode: 'concurrent',
          children,
        },
      ],
    }
  },

  complete(
    ctx: WorkContextContract<RequestState, ResolveBlockWorkProps>,
    children: readonly CompletedWork[],
  ): RenderBlock {
    const properties = replaceCompletedProperties(ctx.props, children)

    return {
      [RENDER_BLOCK_BRAND]: true,
      id: ctx.props.id,
      variant: ctx.props.variant,
      blockType: ctx.props.blockType,
      properties,
    }
  },
}

function replaceCompletedProperties(
  props: ResolveBlockWorkProps,
  children: readonly CompletedWork[],
): Record<string, unknown> {
  const properties = propsWalker.replaceCompletedOutputs(props.properties, children)

  if (!isStringRecord(properties)) {
    throw new ForgeInternalError(`Render block "${props.id}" completed with invalid properties`)
  }

  return properties
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value)
}

function traceBegin(props: ResolveBlockWorkProps): TraceSpanFields {
  return {
    id: props.id,
    variant: props.variant,
    blockType: props.blockType,
  }
}

function traceComplete(output: RenderBlock): TraceSpanFields {
  return {
    visible: output.properties.visibleWhen !== false,
    properties: output.properties,
  }
}

export function createResolveBlockTask(
  id: NodeId,
  variant: string,
  blockType: BlockType,
  properties: Record<PropertyKey, unknown>,
) {
  return createWorkTask(
    String(id),
    RESOLVE_BLOCK_WORK_HANDLER,
    { id, variant, blockType, properties },
    RESOLVE_BLOCK_WORK_INSTRUMENTATION,
  )
}
