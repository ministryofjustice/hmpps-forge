import type nunjucks from 'nunjucks'

import { component } from '@ministryofjustice/hmpps-forge/core/components'
import type { BlockDefinition, ComponentOptions, ForgeComponent } from '@ministryofjustice/hmpps-forge/core/components'

/**
 * Defines a Nunjucks component from a single block interface - `component()` with the
 * renderer pinned, so the render callback receives a typed `nunjucks.Environment`.
 *
 * @example
 * ```typescript
 * export interface MyTextInput extends FieldBlockDefinition {
 *   label: ResolvableString
 * }
 *
 * export const MyTextInput = nunjucksComponent<MyTextInput>('myTextInput', {
 *   field: true,
 *   render: (props, nunjucksEnv) =>
 *     nunjucksEnv.render('components/text-input.njk', { params: { name: props.code } }),
 * })
 * ```
 */
export function nunjucksComponent<TBlock extends BlockDefinition>(
  variant: string,
  options: ComponentOptions<TBlock, string, nunjucks.Environment>,
): ForgeComponent<TBlock, string> {
  return component<TBlock, string, nunjucks.Environment>(variant, options)
}
