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
 * Defines a Nunjucks component from plain props. This compatibility wrapper keeps
 * the props-first callback while declaring an ordinary component function.
 *
 * A local copy of the express-nunjucks helper: importing it from that package would
 * pull the express adapter (and express itself) into every browser bundle that uses
 * these components.
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
