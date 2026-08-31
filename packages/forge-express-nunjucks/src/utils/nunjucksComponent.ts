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

type NunjucksDependencies<TDeps> = TDeps & NunjucksComponentDependencies

/**
 * Defines a Nunjucks component as a Forge function. Its factory receives both the
 * package dependencies and the Nunjucks environment supplied by the adapter.
 *
 * @example
 * ```typescript
 * interface CaseSummaryProps { caseReference: string }
 * interface CaseSummaryDependencies { cases: CaseService }
 *
 * export const CaseSummary = nunjucksComponent<CaseSummaryProps, CaseSummaryDependencies>(
 *   'caseSummary',
 *   {
 *     factory:
 *       ({ cases, nunjucksEnv }) =>
 *       async props => {
 *         const summary = await cases.getSummary(props.caseReference)
 *
 *         return nunjucksEnv.render('components/case-summary.njk', { params: summary })
 *       },
 *   },
 * )
 * ```
 */
export function nunjucksComponent<TProps extends object, TDeps extends object = object>(
  variant: string,
  options: FieldComponentOptions<TProps, NunjucksDependencies<TDeps>>,
): ForgeFieldComponent<TProps, NunjucksDependencies<TDeps>>
export function nunjucksComponent<TProps extends object, TDeps extends object = object>(
  variant: string,
  options: ComponentOptions<TProps, NunjucksDependencies<TDeps>>,
): ForgeComponent<TProps, NunjucksDependencies<TDeps>>
export function nunjucksComponent<TProps extends object, TDeps extends object = object>(
  variant: string,
  options:
    | ComponentOptions<TProps, NunjucksDependencies<TDeps>>
    | FieldComponentOptions<TProps, NunjucksDependencies<TDeps>>,
): ForgeComponent<TProps, NunjucksDependencies<TDeps>> | ForgeFieldComponent<TProps, NunjucksDependencies<TDeps>> {
  if ('field' in options) {
    return component<TProps, NunjucksDependencies<TDeps>>(variant, options)
  }

  return component<TProps, NunjucksDependencies<TDeps>>(variant, options)
}
