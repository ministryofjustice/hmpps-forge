import type nunjucks from 'nunjucks'

import { component } from '@ministryofjustice/hmpps-forge/core/components'
import type {
  BlockDefinition,
  ComponentOptions,
  EvaluatedBlock,
  ForgeComponent,
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
 * Defines a Nunjucks component from a single block interface - `component()` with the
 * renderer pinned, so the render callback receives a typed `nunjucks.Environment`.
 *
 * A local copy of the express-nunjucks helper: importing it from that package would
 * pull the express adapter (and express itself) into every browser bundle that uses
 * these components.
 */
export function nunjucksComponent<TBlock extends BlockDefinition>(
  variant: string,
  options: ComponentOptions<TBlock, string, nunjucks.Environment>,
): ForgeComponent<TBlock, string> {
  return component<TBlock, string, nunjucks.Environment>(variant, options)
}
