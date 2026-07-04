import type { CompiledResolveBlockWorkProps } from '../../../../contracts/compiled/compiledFunctions.type'
import type { RequestExecutionContext } from '../../../../contracts/runtime/RequestExecutionContext.type'
import { RENDER_BLOCK_BRAND } from '../../../../contracts/compiled/renderBlock.brand'
import type { RenderBlock } from '../../../../../framework/rendering/types'
import WorkTaskPropsWalker from '../../work/WorkTaskPropsWalker'
import type {
  CompletedWork,
  WorkContextContract,
  WorkTask,
  WorkHandler,
  WorkInstrumentation,
  WorkUnitFields,
} from '../../../../contracts/runtime/work.type'

export type ResolveBlockWorkProps = CompiledResolveBlockWorkProps

export type ResolveBlockWorkTask = WorkTask<'resolve.block', ResolveBlockWorkProps>

export const RESOLVE_BLOCK_KIND = 'resolve.block'

const propsWalker = new WorkTaskPropsWalker()

export const RESOLVE_BLOCK_WORK_INSTRUMENTATION: WorkInstrumentation<ResolveBlockWorkProps, RenderBlock> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestExecutionContext, ResolveBlockWorkProps>) {
    return traceBegin(ctx.props)
  },

  resolveTraceMetadataAtFinish(_ctx, output) {
    return traceComplete(output)
  },
}

export const RESOLVE_BLOCK_WORK_HANDLER: WorkHandler<'resolve.block', ResolveBlockWorkProps> = {
  kind: RESOLVE_BLOCK_KIND,

  begin(ctx: WorkContextContract<RequestExecutionContext, ResolveBlockWorkProps>) {
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
    ctx: WorkContextContract<RequestExecutionContext, ResolveBlockWorkProps>,
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
    throw new Error(`Render block "${props.id}" completed with invalid properties`)
  }

  return properties
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value)
}

function traceBegin(props: ResolveBlockWorkProps): WorkUnitFields {
  return {
    id: props.id,
    variant: props.variant,
    blockType: props.blockType,
  }
}

function traceComplete(output: RenderBlock): WorkUnitFields {
  return {
    visible: output.properties.visibleWhen !== false,
    properties: output.properties,
  }
}
