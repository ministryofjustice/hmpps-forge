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
 * The nunjucksEnv is passed by the TemplateRenderer as the `renderer` parameter,
 * eliminating the need for a separate binding step.
 *
 * @param variant - The block variant identifier
 * @param render - Render function that receives (block, nunjucksEnv)
 * @returns A component ready for registration with FormEngine
 *
 * @example
 * ```typescript
 * export const mojCard = buildNunjucksComponent<MOJCard>(
 *   'mojCard',
 *   async (block, nunjucksEnv) => {
 *     return nunjucksEnv.render('moj/components/card/template.njk', { params })
 *   }
 * )
 * ```
 */
export const buildNunjucksComponent = <T extends BlockDefinition>(
  variant: string,
  render: NunjucksComponentRenderer<T>,
): ComponentRegistryEntry<T> => ({
  variant,
  render: (block, renderer) => render(block, renderer as nunjucks.Environment),
})
