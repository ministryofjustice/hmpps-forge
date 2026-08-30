import type nunjucks from 'nunjucks'

import { component } from '@ministryofjustice/hmpps-forge/core/components'
import type {
  ComponentOptions,
  ComponentRenderProps,
  FieldComponentOptions,
  FieldComponentRenderProps,
  ForgeComponent,
  ForgeFieldComponent,
} from '@ministryofjustice/hmpps-forge/core/components'

export interface NunjucksComponentDependencies {
  readonly nunjucksEnv: nunjucks.Environment
}

type NunjucksComponentOptions<TProps extends object> = Omit<
  ComponentOptions<TProps, NunjucksComponentDependencies, string>,
  'factory'
> & {
  readonly render: (props: ComponentRenderProps<TProps>, renderer: nunjucks.Environment) => string
}

type NunjucksFieldComponentOptions<TProps extends object> = Omit<
  FieldComponentOptions<TProps, NunjucksComponentDependencies, string>,
  'factory'
> & {
  readonly render: (props: FieldComponentRenderProps<TProps>, renderer: nunjucks.Environment) => string
}

/**
 * Defines a Nunjucks component from a single block interface. This compatibility
 * wrapper keeps the props-first callback while declaring an ordinary component function.
 *
 * @example
 * ```typescript
 * export interface MyTextInputProps { label: string }
 *
 * export const MyTextInput = nunjucksComponent<MyTextInputProps>('myTextInput', {
 *   field: true,
 *   render: (props, nunjucksEnv) =>
 *     nunjucksEnv.render('components/text-input.njk', { params: { name: props.code } }),
 * })
 * ```
 */
export function nunjucksComponent<TProps extends object>(
  variant: string,
  options: NunjucksFieldComponentOptions<TProps>,
): ForgeFieldComponent<TProps, NunjucksComponentDependencies, string>
export function nunjucksComponent<TProps extends object>(
  variant: string,
  options: NunjucksComponentOptions<TProps>,
): ForgeComponent<TProps, NunjucksComponentDependencies, string>
export function nunjucksComponent<TProps extends object>(
  variant: string,
  options: NunjucksComponentOptions<TProps> | NunjucksFieldComponentOptions<TProps>,
):
  | ForgeComponent<TProps, NunjucksComponentDependencies, string>
  | ForgeFieldComponent<TProps, NunjucksComponentDependencies, string> {
  if ('field' in options) {
    const { render: renderComponent, ...renderOptions } = options

    return component<TProps, NunjucksComponentDependencies, string>(variant, {
      ...renderOptions,
      factory:
        ({ nunjucksEnv }) =>
        ({ props }) => {
          const output = renderComponent(props, nunjucksEnv)

          if (typeof output !== 'string') {
            throw new TypeError(`Nunjucks component "${variant}" must return an HTML string`)
          }

          return output
        },
    })
  }

  const { render: renderComponent, ...renderOptions } = options

  return component<TProps, NunjucksComponentDependencies, string>(variant, {
    ...renderOptions,
    factory:
      ({ nunjucksEnv }) =>
      ({ props }) => {
        const output = renderComponent(props, nunjucksEnv)

        if (typeof output !== 'string') {
          throw new TypeError(`Nunjucks component "${variant}" must return an HTML string`)
        }

        return output
      },
  })
}
