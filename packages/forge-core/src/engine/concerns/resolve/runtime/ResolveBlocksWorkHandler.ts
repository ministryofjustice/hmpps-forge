import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../chassis/contracts/work/work.type'
import type { TraceSpanFields } from '../../../chassis/tracing/traceSpan.type'
import type { ResolveBlocksOutput } from '../contracts/resolveBlocksOutput.type'
import { childOutputs, createWorkTask } from '../../../chassis/work/workTask'
import { RESOLVE_BLOCK_KIND } from './ResolveBlockWorkHandler'
import WorkTaskPropsWalker from '../../../chassis/work/WorkTaskPropsWalker'
import ForgeInternalError from '../../../errors/ForgeInternalError'

export interface ResolveBlocksWorkProps {
  readonly blocks: unknown
  readonly step: Record<string, unknown>
  readonly ancestors: readonly Record<string, unknown>[]
}

export const RESOLVE_BLOCKS_KIND = 'resolve.blocks'

const propsWalker = new WorkTaskPropsWalker()

export const RESOLVE_BLOCKS_WORK_INSTRUMENTATION: WorkInstrumentation<ResolveBlocksWorkProps, ResolveBlocksOutput> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestState, ResolveBlocksWorkProps>) {
    return traceBegin(ctx.props)
  },

  resolveTraceMetadataAtFinish(_ctx, output) {
    return traceComplete(output)
  },
}

export const RESOLVE_BLOCKS_WORK_HANDLER: WorkHandler<'resolve.blocks', ResolveBlocksWorkProps> = {
  kind: RESOLVE_BLOCKS_KIND,

  begin(ctx: WorkContextContract<RequestState, ResolveBlocksWorkProps>) {
    const blockTasks = propsWalker.collect(ctx.props.blocks)
    const renderMetadataTasks = propsWalker.collect({
      step: ctx.props.step,
      ancestors: ctx.props.ancestors,
    })

    return {
      groups: [
        {
          mode: 'concurrent',
          children: [...blockTasks, ...renderMetadataTasks],
        },
      ],
    }
  },

  complete(
    ctx: WorkContextContract<RequestState, ResolveBlocksWorkProps>,
    children: readonly CompletedWork[],
  ): ResolveBlocksOutput {
    const blockTaskCount = propsWalker.collect(ctx.props.blocks).length
    const blockChildren = children.slice(0, blockTaskCount)
    const renderMetadataChildren = children.slice(blockTaskCount)
    const blocks = childOutputs(blockChildren, RESOLVE_BLOCK_KIND)
    const blockShape = propsWalker.replaceCompletedOutputs(ctx.props.blocks, blockChildren)
    const renderMetadata = propsWalker.replaceCompletedOutputs(
      { step: ctx.props.step, ancestors: ctx.props.ancestors },
      renderMetadataChildren,
    )

    if (!isResolvedRenderMetadata(renderMetadata)) {
      throw new ForgeInternalError('Resolve work completed with invalid step renderer metadata')
    }

    return { blocks, blockShape, step: renderMetadata.step, ancestors: renderMetadata.ancestors }
  },
}

function isResolvedRenderMetadata(
  value: unknown,
): value is { step: Record<string, unknown>; ancestors: readonly Record<string, unknown>[] } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const metadata = value as { step?: unknown; ancestors?: unknown }

  return metadata.step !== null &&
    typeof metadata.step === 'object' &&
    !Array.isArray(metadata.step) &&
    Array.isArray(metadata.ancestors)
}

function traceBegin(props: ResolveBlocksWorkProps): TraceSpanFields {
  return {
    blocks: propsWalker.collect(props.blocks).length,
  }
}

function traceComplete(output: ResolveBlocksOutput): TraceSpanFields {
  return {
    visibleBlocks: output.blocks.filter(block => block.properties.visibleWhen !== false).length,
  }
}

export function createResolveBlocksTask(
  blocks: unknown,
  step: Record<string, unknown>,
  ancestors: readonly Record<string, unknown>[],
) {
  return createWorkTask(
    'resolve-blocks',
    RESOLVE_BLOCKS_WORK_HANDLER,
    { blocks, step, ancestors },
    RESOLVE_BLOCKS_WORK_INSTRUMENTATION,
  )
}
