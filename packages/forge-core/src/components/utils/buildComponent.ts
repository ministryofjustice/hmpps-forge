import type { ZodType } from 'zod'
import { ComponentRegistryEntry, ComponentRenderer } from '../types/components.type'
import type { BlockDefinition } from '../types/structures.type'

export interface BuildComponentOptions {
  inputSchema?: ZodType
  multiple?: boolean
}

/**
 * Creates a component for the registry.
 *
 * Use this for simple components that render HTML directly, such as
 * HTML passthrough or collection blocks.
 *
 *
 * @param variant - The block variant identifier (e.g., 'html', 'collection-block')
 * @param renderer - Function that takes a block and returns HTML string
 * @param options - Optional input schema and fixed-shape `multiple` flag for the entry
 * @returns A registerable component
 *
 * @example
 * ```typescript
 * export const html = buildComponent<HtmlBlock>('html', block => {
 *   return block.content
 * })
 * ```
 */
export const buildComponent = <T extends BlockDefinition, TRenderOutput = string>(
  variant: string,
  renderer: ComponentRenderer<T, TRenderOutput>,
  options: BuildComponentOptions = {},
): ComponentRegistryEntry<T, TRenderOutput> => ({
  variant,
  render: renderer,
  ...(options.inputSchema !== undefined && { inputSchema: options.inputSchema }),
  ...(options.multiple !== undefined && { multiple: options.multiple }),
})
