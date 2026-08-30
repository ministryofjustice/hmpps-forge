import { component } from '@ministryofjustice/hmpps-forge/core/components'
import type {
  ComponentOptions,
  ComponentRenderProps,
  FieldComponentOptions,
  FieldComponentRenderProps,
  ForgeComponent,
  ForgeFieldComponent,
} from '@ministryofjustice/hmpps-forge/core/components'

import type { RawHtml } from '../runtime/jsx-runtime'

type NoDependencies = Record<string, never>

type JsxComponentOptions<TProps extends object> = Omit<ComponentOptions<TProps, NoDependencies, string>, 'factory'> & {
  readonly render: (props: ComponentRenderProps<TProps>, renderer: undefined) => RawHtml
}

type JsxFieldComponentOptions<TProps extends object> = Omit<
  FieldComponentOptions<TProps, NoDependencies, string>,
  'factory'
> & {
  readonly render: (props: FieldComponentRenderProps<TProps>, renderer: undefined) => RawHtml
}

/**
 * Defines a component whose render is written in JSX. This compatibility wrapper
 * keeps the props-first callback and stringifies `RawHtml` while declaring an
 * ordinary component function.
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
  options: JsxFieldComponentOptions<TProps>,
): ForgeFieldComponent<TProps, NoDependencies, string>
export function jsxComponent<TProps extends object>(
  variant: string,
  options: JsxComponentOptions<TProps>,
): ForgeComponent<TProps, NoDependencies, string>
export function jsxComponent<TProps extends object>(
  variant: string,
  options: JsxComponentOptions<TProps> | JsxFieldComponentOptions<TProps>,
): ForgeComponent<TProps, NoDependencies, string> | ForgeFieldComponent<TProps, NoDependencies, string> {
  if ('field' in options) {
    const { render: renderComponent, ...renderOptions } = options

    return component<TProps, NoDependencies, string>(variant, {
      ...renderOptions,
      factory:
        () =>
        ({ props }) =>
          String(renderComponent(props, undefined)),
    })
  }

  const { render: renderComponent, ...renderOptions } = options

  return component<TProps, NoDependencies, string>(variant, {
    ...renderOptions,
    factory:
      () =>
      ({ props }) =>
        String(renderComponent(props, undefined)),
  })
}
