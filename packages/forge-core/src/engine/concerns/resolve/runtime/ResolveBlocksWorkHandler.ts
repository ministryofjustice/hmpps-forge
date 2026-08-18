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
import { RESOLVE_BLOCK_KIND, type ResolveBlockWorkTask } from './ResolveBlockWorkHandler'

export interface ResolveBlocksWorkProps {
  readonly blocks: readonly ResolveBlockWorkTask[]
  readonly step: Record<string, unknown>
  readonly ancestors: readonly Record<string, unknown>[]
}

export const RESOLVE_BLOCKS_KIND = 'resolve.blocks'

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
    return {
      groups: [
        {
          mode: 'concurrent',
          children: ctx.props.blocks,
        },
      ],
    }
  },

  complete(
    ctx: WorkContextContract<RequestState, ResolveBlocksWorkProps>,
    children: readonly CompletedWork[],
  ): ResolveBlocksOutput {
    const blocks = childOutputs(children, RESOLVE_BLOCK_KIND)

    return { blocks, step: ctx.props.step, ancestors: ctx.props.ancestors }
  },
}

function traceBegin(props: ResolveBlocksWorkProps): TraceSpanFields {
  return {
    blocks: props.blocks.length,
  }
}

function traceComplete(output: ResolveBlocksOutput): TraceSpanFields {
  return {
    visibleBlocks: output.blocks.filter(block => block.properties.visibleWhen !== false).length,
  }
}

export function createResolveBlocksTask(
  blocks: readonly ResolveBlockWorkTask[],
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
