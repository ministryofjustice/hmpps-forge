import nunjucks from 'nunjucks'

import {
  BlockDefinition,
  EvaluatedBlock,
  ComponentRegistryEntry,
  BuildComponentOptions,
} from '@ministryofjustice/hmpps-forge/core/components'

/**
 * Render function for Nunjucks components.
 * Receives the evaluated block and a nunjucks environment (passed as renderer by TemplateRenderer).
 */
export type NunjucksComponentRenderer<T extends BlockDefinition> = (
  block: EvaluatedBlock<T>,
  nunjucksEnv: nunjucks.Environment,
) => string

/**
 * Creates a Nunjucks component that receives its renderer at render time.
 *
 * Prefer `nunjucksComponent` for new components - one block interface plus one call
 * replaces the props interface, block interface, wrapper function and this registration.
 * This function will be deprecated once the built-in components have moved over.
 *
 * @param variant - The block variant identifier
 * @param render - Render function that receives (block, nunjucksEnv)
 * @param options - Optional input schema and fixed-shape `multiple` override for the entry
 * @returns A component ready for registration with Forge
 *
 * @example
 * ```typescript
 * export const myTextInput = buildNunjucksComponent<MyTextInput>(
 *   'myTextInput',
 *   (block, nunjucksEnv) => {
 *     return nunjucksEnv.render('components/text-input.njk', { block })
 *   }
 * )
 * ```
 */
export const buildNunjucksComponent = <T extends BlockDefinition>(
  variant: string,
  render: NunjucksComponentRenderer<T>,
  options: BuildComponentOptions = {},
): ComponentRegistryEntry<T, string> => ({
  variant,
  render: (block, renderer) => render(block, renderer as nunjucks.Environment),
  ...(options.inputSchema !== undefined && { inputSchema: options.inputSchema }),
  ...(options.multiple !== undefined && { multiple: options.multiple }),
})
