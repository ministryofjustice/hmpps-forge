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
 * @deprecated Declare the component with `nunjucksComponent()` instead - one
 * declaration is both the block builder and the registry entry, and using it
 * in a journey registers it automatically.
 *
 * @param variant - The block variant identifier
 * @param render - Render function that receives (block, nunjucksEnv)
 * @param options - Optional input schema and fixed-shape `multiple` flag for the entry
 * @returns A component ready for registration with Forge
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
