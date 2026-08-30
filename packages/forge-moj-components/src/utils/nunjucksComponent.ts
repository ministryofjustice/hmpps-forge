import type nunjucks from 'nunjucks'

import { component } from '@ministryofjustice/hmpps-forge/core/components'
import type {
  ComponentOptions,
  FieldComponentOptions,
  ForgeComponent,
  ForgeFieldComponent,
} from '@ministryofjustice/hmpps-forge/core/components'

export interface NunjucksComponentDependencies {
  readonly nunjucksEnv: nunjucks.Environment
}

type NunjucksDependencies<TDependencies> = TDependencies & NunjucksComponentDependencies

/**
 * Defines a Nunjucks component as a Forge function, with the Nunjucks environment
 * available alongside its package dependencies.
 *
 * A local copy of the express-nunjucks helper: importing it from that package would
 * pull the express adapter (and express itself) into every browser bundle that uses
 * these components.
 */
export function nunjucksComponent<TProps extends object, TDependencies extends object = object>(
  variant: string,
  options: FieldComponentOptions<TProps, NunjucksDependencies<TDependencies>, string>,
): ForgeFieldComponent<TProps, NunjucksDependencies<TDependencies>, string>
export function nunjucksComponent<TProps extends object, TDependencies extends object = object>(
  variant: string,
  options: ComponentOptions<TProps, NunjucksDependencies<TDependencies>, string>,
): ForgeComponent<TProps, NunjucksDependencies<TDependencies>, string>
export function nunjucksComponent<TProps extends object, TDependencies extends object = object>(
  variant: string,
  options:
    | ComponentOptions<TProps, NunjucksDependencies<TDependencies>, string>
    | FieldComponentOptions<TProps, NunjucksDependencies<TDependencies>, string>,
):
  | ForgeComponent<TProps, NunjucksDependencies<TDependencies>, string>
  | ForgeFieldComponent<TProps, NunjucksDependencies<TDependencies>, string> {
  if ('field' in options) {
    return component<TProps, NunjucksDependencies<TDependencies>, string>(variant, options)
  }

  return component<TProps, NunjucksDependencies<TDependencies>, string>(variant, options)
}
