import nunjucks from 'nunjucks'

import { BlockDefinition, EvaluatedBlock } from '@form-engine/form/types/structures.type'
import { ComponentRegistryEntry } from '@form-engine/registry/types/components.type'

/**
 * Render function for Nunjucks components.
 * Receives the evaluated block and a nunjucks environment (passed as renderer by TemplateRenderer).
 */
export type NunjucksComponentRenderer<T extends BlockDefinition> = (
  block: EvaluatedBlock<T>,
  nunjucksEnv: nunjucks.Environment,
) => Promise<string>

/**
 * Creates a Nunjucks component that receives its renderer at render time.
 *
 * @param variant - The block variant identifier
 * @param render - Render function that receives (block, nunjucksEnv)
 * @returns A component ready for registration with FormEngine
 *
 * @example
 * ```typescript
 * export const myTextInput = buildNunjucksComponent<MyTextInput>(
 *   'myTextInput',
 *   async (block, nunjucksEnv) => {
 *     return nunjucksEnv.render('components/text-input.njk', { block })
 *   }
 * )
 * ```
 */
export const buildNunjucksComponent = <T extends BlockDefinition>(
  variant: string,
  render: NunjucksComponentRenderer<T>,
): ComponentRegistryEntry<T> => ({
  variant,
  render: (block, renderer: nunjucks.Environment) => render(block, renderer),
})
