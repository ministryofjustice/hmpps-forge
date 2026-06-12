import nunjucks from 'nunjucks'

import { BlockDefinition, EvaluatedBlock, ComponentRegistryEntry } from '@ministryofjustice/hmpps-forge/core/components'

/**
 * Render function for Nunjucks components.
 * Receives the evaluated block and a nunjucks environment (passed as renderer by NunjucksRenderer).
 */
export type NunjucksComponentRenderer<T extends BlockDefinition> = (
  block: EvaluatedBlock<T>,
  nunjucksEnv: nunjucks.Environment,
) => string

/**
 * Creates a Nunjucks component that receives its renderer at render time.
 *
 * @param variant - The block variant identifier
 * @param render - Render function that receives (block, nunjucksEnv)
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
): ComponentRegistryEntry<T, string> => ({
  variant,
  render: (block, renderer) => render(block, renderer as nunjucks.Environment),
})
