import { component } from '@ministryofjustice/hmpps-forge/core/components'
import type {
  BlockDefinition,
  ComponentOptions,
  ForgeComponent,
  ResolvedPropsOf,
} from '@ministryofjustice/hmpps-forge/core/components'

import type { RawHtml } from '../runtime/jsx-runtime'

/**
 * Defines a component whose render is written in JSX - `component()` with the output
 * pinned to the JSX runtime's `RawHtml`, stringified at the boundary so the registry
 * entry produces the same plain HTML strings as every other component.
 *
 * No renderer is involved: JSX compiles to direct string building, so unlike
 * `nunjucksComponent` there is no environment to inject.
 *
 * @experimental Part of the experimental JSX component API - may change or be removed
 * in a minor release.
 *
 * @example
 * ```tsx
 * export interface MyBadge extends BlockDefinition {
 *   text: ResolvableString
 * }
 *
 * export const MyBadge = jsxComponent<MyBadge>('myBadge', {
 *   render: props => <strong class="moj-badge">{props.text}</strong>,
 * })
 * ```
 */
export function jsxComponent<TBlock extends BlockDefinition>(
  variant: string,
  options: ComponentOptions<TBlock, RawHtml, undefined>,
): ForgeComponent<TBlock, string> {
  // TBlock is still generic here, so the conditional options type is unresolved - read
  // the render through a minimal shape, as component() itself does with its options.
  const { render } = options as { render: (props: ResolvedPropsOf<TBlock>, renderer: undefined) => RawHtml }

  const stringOptions = {
    ...options,
    render: (props: ResolvedPropsOf<TBlock>) => String(render(props, undefined)),
  } as unknown as ComponentOptions<TBlock, string, undefined>

  return component<TBlock, string, undefined>(variant, stringOptions)
}
