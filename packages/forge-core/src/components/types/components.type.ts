import type { ZodType } from 'zod'
import type { BlockDefinition, EvaluatedBlock } from './structures.type'

type MaybePromise<T> = T | Promise<T>

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
) => MaybePromise<TRenderOutput>

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
  render(block: EvaluatedBlock<T>, renderer?: unknown): MaybePromise<TRenderOutput>

  /**
   * Describes the shape of the submitted (post-normalise) value this component can
   * legitimately produce. A rendered text input can only ever submit a string, so
   * anything failing this schema did not come from the rendered form.
   */
  inputSchema?: ZodType

  /**
   * Whether the component keeps every submitted value rather than the first non-empty one.
   * Fixed-shape components such as checkboxes declare it here, so it is a component
   * property rather than an author decision.
   */
  multiple?: boolean
}
