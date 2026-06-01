import type { BlockDefinition, EvaluatedBlock } from './structures.type'

/**
 * Component render function
 *
 * Components are functions that take an evaluated block and an optional renderer,
 * returning framework-specific output. The optional `renderer` parameter allows
 * framework adapters to inject rendering dependencies at render time.
 *
 * @param block - The evaluated block with resolved properties
 * @param renderer - Optional renderer provided by the framework adapter
 * @returns Rendered component output
 *
 * @example
 * ```typescript
 * // Simple component (no renderer needed)
 * const htmlComponent: ComponentRenderer<HtmlBlock, string> = block => block.content
 *
 * // Template-based component (uses renderer)
 * const textInput: ComponentRenderer<TextInputBlock, string> = (block, renderer) => {
 *   const nunjucksEnv = renderer as nunjucks.Environment
 *   return nunjucksEnv.render('govuk/components/input/template.njk', { params })
 * }
 * ```
 */
export type ComponentRenderer<T extends BlockDefinition, TRenderOutput = unknown> = (
  block: EvaluatedBlock<T>,
  renderer?: unknown,
) => TRenderOutput

/**
 * Component registry entry
 *
 * All components have the same simple interface - a variant name and a render function.
 * The render output is intentionally adapter-specific: Nunjucks components return
 * strings, React components may return React nodes, and test components can return
 * whichever value the test needs.
 */
export interface ComponentRegistryEntry<T extends BlockDefinition, TRenderOutput = unknown> {
  variant: string
  render(block: EvaluatedBlock<T>, renderer?: unknown): TRenderOutput
}
