import { ComponentRegistryEntry, ComponentRenderer } from '@form-engine/registry/types/components.type'
import { BlockDefinition } from '../../form/types/structures.type'

/**
 * Creates a component for the registry.
 *
 * Use this for simple components that render HTML directly, such as
 * HTML passthrough or collection blocks.
 *
 *
 * @param variant - The block variant identifier (e.g., 'html', 'collection-block')
 * @param renderer - Function that takes a block and returns HTML string
 * @returns A registerable component
 *
 * @example
 * ```typescript
 * export const html = buildComponent<HtmlBlock>('html', async block => {
 *   return block.content
 * })
 * ```
 */
export const buildComponent = <T extends BlockDefinition>(
  variant: string,
  renderer: ComponentRenderer<T>,
): ComponentRegistryEntry<T> => ({
  variant,
  render: renderer,
})
