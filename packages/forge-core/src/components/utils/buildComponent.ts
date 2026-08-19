import type { ZodType } from 'zod'
import { ComponentRegistryEntry, ComponentRenderer } from '../types/components.type'
import type { BlockDefinition } from '../types/structures.type'

export interface BuildComponentOptions {
  inputSchema?: ZodType
  multiple?: boolean
}

/**
 * Creates a registry entry with no block builder attached - just a variant
 * and a render function.
 *
 * @deprecated Declare the component with `component()` instead - one declaration
 * is both the block builder and the registry entry, and using it in a journey
 * registers it automatically.
 *
 * @param variant - The block variant identifier (e.g., 'html', 'collection-block')
 * @param renderer - Function that takes a block and returns HTML string
 * @param options - Optional input schema and fixed-shape `multiple` flag for the entry
 * @returns A registerable component
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
