import nunjucks from 'nunjucks'

import { BlockDefinition, EvaluatedBlock, ComponentRegistryEntry } from 'hmpps-forge/core/components'

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
 * @param variant - The block variant identifier
 * @param render - Render function that receives (block, nunjucksEnv)
 * @returns A component ready for registration with FormEngine
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
): ComponentRegistryEntry<T> => ({
  variant,
  render: (block, renderer) => {
    if (!isNunjucksEnvironment(renderer)) {
      throw new Error(`Component "${variant}" requires a Nunjucks renderer`)
    }

    return render(block, renderer)
  },
})

function isNunjucksEnvironment(renderer: unknown): renderer is nunjucks.Environment {
  return renderer instanceof nunjucks.Environment
}
