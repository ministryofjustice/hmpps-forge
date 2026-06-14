import { StructureType } from '../../../../authoring/types/enums'
import type { BlockDefinition, EvaluatedBlock } from '../../../../components/types/structures.type'
import type { ForgeRenderer, RenderBlock, RenderContext } from '../../../../framework/rendering/types'
import type { ComponentRegistry } from '../../../../framework/types/adapter.type'
import type { ValidationResult } from '../../../contracts/runtime/validationResult.type'
import { isRenderBlock } from '../../rendering/typeguards'
import type TraceRecorder from '../trace/TraceRecorder'
import { measureScoped } from '../trace/TraceRecorder'

/**
 * Drives the bound renderer over a hydrated RenderContext's blocks: filters
 * visibility, resolves each block's registry entry, renders nested blocks into
 * their parent's properties (children before parents), attaches validation
 * errors, and returns the top-level outputs in render order. The renderer owns
 * only host-specific output production. When a trace recorder is supplied,
 * records one decision per block rendered, nested blocks included.
 */
export function evaluateRenderOutput<TOut>(
  context: RenderContext,
  componentRegistry: ComponentRegistry,
  renderer: ForgeRenderer<TOut>,
  trace?: TraceRecorder,
): TOut[] {
  return renderVisibleBlocks(context.blocks, context.showValidationFailures, componentRegistry, renderer, trace)
}

/** Renders every visible block (filters out blocks where visibleWhen is false). */
function renderVisibleBlocks<TOut>(
  blocks: RenderBlock[],
  showValidationFailures: boolean,
  componentRegistry: ComponentRegistry,
  renderer: ForgeRenderer<TOut>,
  trace: TraceRecorder | undefined,
): TOut[] {
  const visibleBlocks = blocks.filter(block => isRenderBlock(block) && block.properties.visibleWhen !== false)

  return visibleBlocks.map(block => renderBlock(block, showValidationFailures, componentRegistry, renderer, trace))
}

/**
 * Renders a single block through the renderer, recording the render against the
 * block's identity. Uses a scoped measure so that nested block renders inside
 * the property transformation become children of this unit in the trace tree.
 */
function renderBlock<TOut>(
  block: RenderBlock,
  showValidationFailures: boolean,
  componentRegistry: ComponentRegistry,
  renderer: ForgeRenderer<TOut>,
  trace: TraceRecorder | undefined,
): TOut {
  const component = componentRegistry.get<BlockDefinition, TOut>(block.variant)

  if (!component) {
    const availableVariants = Array.from(componentRegistry.getAll().keys())

    throw new Error(
      `Component variant "${block.variant}" not found in registry. ` +
        `Available variants: ${availableVariants.join(', ')}`,
    )
  }

  return measureScoped(trace, { kind: 'block-render', nodeId: block.id, variant: block.variant }, () => {
    const transformedProperties = transformPropertiesWithRenderedBlocks(
      block.properties,
      showValidationFailures,
      componentRegistry,
      renderer,
      trace,
    )

    const evaluatedBlock = toEvaluatedBlock(
      {
        ...block,
        properties: transformedProperties,
      },
      showValidationFailures,
    )

    return renderer.renderBlock(component, evaluatedBlock)
  })
}

/** Convert RenderBlock to EvaluatedBlock for the component */
function toEvaluatedBlock(block: RenderBlock, showErrors: boolean): EvaluatedBlock<BlockDefinition> {
  const errors = showErrors ? extractErrorsFromValidations(block.properties.validWhen) : []

  // The EvaluatedBlock conditional type cannot express this runtime-transformed
  // shape (properties spread plus errors), so the cast is unavoidable.
  return {
    ...block.properties,
    type: StructureType.BLOCK,
    variant: block.variant,
    nodeId: block.id,
    errors,
  } as unknown as EvaluatedBlock<BlockDefinition>
}

/** Extract failed validation results as error objects */
function extractErrorsFromValidations(validate: unknown): { message: string; details?: Record<string, unknown> }[] {
  if (!Array.isArray(validate)) {
    return []
  }

  return (validate as ValidationResult[])
    .filter(result => !result.passed)
    .map(result => ({
      message: result.message,
      details: result.details,
    }))
}

/** Recursively transform properties, rendering nested blocks through the renderer */
function transformPropertiesWithRenderedBlocks<TOut>(
  properties: Record<string, unknown>,
  showValidationFailures: boolean,
  componentRegistry: ComponentRegistry,
  renderer: ForgeRenderer<TOut>,
  trace: TraceRecorder | undefined,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  Object.entries(properties).forEach(([key, value]) => {
    result[key] = transformValue(value, showValidationFailures, componentRegistry, renderer, trace)
  })

  return result
}

/** Transform a single value, rendering nested blocks as needed */
function transformValue<TOut>(
  value: unknown,
  showValidationFailures: boolean,
  componentRegistry: ComponentRegistry,
  renderer: ForgeRenderer<TOut>,
  trace: TraceRecorder | undefined,
): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (isRenderBlock(value)) {
    return renderNestedBlock(value, showValidationFailures, componentRegistry, renderer, trace)
  }

  if (Array.isArray(value)) {
    const transformed = value.map(element =>
      transformValue(element, showValidationFailures, componentRegistry, renderer, trace),
    )

    return transformed.filter(item => item !== null)
  }

  if (typeof value === 'object') {
    return transformPropertiesWithRenderedBlocks(
      value as Record<string, unknown>,
      showValidationFailures,
      componentRegistry,
      renderer,
      trace,
    )
  }

  return value
}

/**
 * Renders a nested block and hands its output to the renderer to wrap for
 * embedding in the parent's properties. Returns null for hidden nested blocks
 * so array transforms can filter them out.
 */
function renderNestedBlock<TOut>(
  block: RenderBlock,
  showValidationFailures: boolean,
  componentRegistry: ComponentRegistry,
  renderer: ForgeRenderer<TOut>,
  trace: TraceRecorder | undefined,
): unknown {
  const { visibleWhen, ...properties } = block.properties

  if (visibleWhen === false) {
    return null
  }

  const output = renderBlock(block, showValidationFailures, componentRegistry, renderer, trace)

  return renderer.wrapNestedBlock(
    {
      type: StructureType.BLOCK,
      blockType: block.blockType,
      variant: block.variant,
      ...properties,
    },
    output,
  )
}
