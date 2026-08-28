import { component } from '@ministryofjustice/hmpps-forge/core/components'
import type {
  ComponentOptions,
  FieldComponentOptions,
  ForgeComponent,
  ForgeFieldComponent,
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
 * export interface MyBadgeProps { text: string }
 *
 * export const MyBadge = jsxComponent<MyBadgeProps>('myBadge', {
 *   render: props => <strong class="moj-badge">{props.text}</strong>,
 * })
 * ```
 */
export function jsxComponent<TProps extends object>(
  variant: string,
  options: FieldComponentOptions<TProps, RawHtml, undefined>,
): ForgeFieldComponent<TProps, string>
export function jsxComponent<TProps extends object>(
  variant: string,
  options: ComponentOptions<TProps, RawHtml, undefined>,
): ForgeComponent<TProps, string>
export function jsxComponent<TProps extends object>(
  variant: string,
  options: ComponentOptions<TProps, RawHtml, undefined> | FieldComponentOptions<TProps, RawHtml, undefined>,
): ForgeComponent<TProps, string> | ForgeFieldComponent<TProps, string> {
  if ('field' in options) {
    const { render } = options

    return component<TProps, string, undefined>(variant, {
      ...options,
      render: props => String(render(props, undefined)),
    })
  }

  const { render } = options

  return component<TProps, string, undefined>(variant, {
    ...options,
    render: props => String(render(props, undefined)),
  })
}
