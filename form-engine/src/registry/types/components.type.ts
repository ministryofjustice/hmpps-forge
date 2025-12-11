import { BlockDefinition, EvaluatedBlock } from '@form-engine/form/types/structures.type'

/**
 * Component render function
 *
 * Components are functions that take an evaluated block and an optional renderer,
 * returning HTML. The optional `renderer` parameter allows framework adapters to
 * inject template engines (e.g., Nunjucks) at render time.
 *
 * @param block - The evaluated block with resolved properties
 * @param renderer - Optional renderer provided by the framework adapter (e.g., nunjucks.Environment)
 * @returns Rendered HTML string
 *
 * @example
 * ```typescript
 * // Simple component (no renderer needed)
 * const htmlComponent: ComponentRenderer<HtmlBlock> = async (block) => block.content
 *
 * // Template-based component (uses renderer)
 * const textInput: ComponentRenderer<TextInputBlock> = async (block, renderer) => {
 *   const nunjucksEnv = renderer as nunjucks.Environment
 *   return nunjucksEnv.render('govuk/components/input/template.njk', { params })
 * }
 * ```
 */
export type ComponentRenderer<T extends BlockDefinition> = (
  block: EvaluatedBlock<T>,
  renderer?: unknown,
) => Promise<string>

/**
 * Component registry entry
 *
 * All components have the same simple interface - a variant name and a render function.
 * This applies to both core components (html, collectionBlock) and template-based
 * components  after they've been given their dependencies.
 */
export interface ComponentRegistryEntry<T extends BlockDefinition> {
  variant: string
  render: ComponentRenderer<T>
}
