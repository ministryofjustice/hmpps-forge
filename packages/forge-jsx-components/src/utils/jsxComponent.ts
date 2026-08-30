import { component } from '@ministryofjustice/hmpps-forge/core/components'
import type {
  ComponentOptions,
  FieldComponentOptions,
  ForgeComponent,
  ForgeFieldComponent,
} from '@ministryofjustice/hmpps-forge/core/components'

import type { RawHtml } from '../runtime/jsx-runtime'

/**
 * Defines a component whose evaluator is written in JSX. The factory receives its
 * package dependencies, and the resulting `RawHtml` is converted to the string Forge
 * expects after synchronous or asynchronous evaluation completes.
 *
 * @experimental Part of the experimental JSX component API - may change or be removed
 * in a minor release.
 *
 * @example
 * ```tsx
 * interface CaseHeadingProps { caseReference: string }
 * interface CaseHeadingDependencies { cases: CaseService }
 *
 * export const CaseHeading = jsxComponent<CaseHeadingProps, CaseHeadingDependencies>('caseHeading', {
 *   factory:
 *     ({ cases }) =>
 *     async ({ props }) => {
 *       const caseDetails = await cases.get(props.caseReference)
 *
 *       return <h1>{caseDetails.title}</h1>
 *     },
 * })
 * ```
 */
export function jsxComponent<TProps extends object, TDependencies = Record<string, never>>(
  variant: string,
  options: FieldComponentOptions<TProps, TDependencies, RawHtml>,
): ForgeFieldComponent<TProps, TDependencies, string>
export function jsxComponent<TProps extends object, TDependencies = Record<string, never>>(
  variant: string,
  options: ComponentOptions<TProps, TDependencies, RawHtml>,
): ForgeComponent<TProps, TDependencies, string>
export function jsxComponent<TProps extends object, TDependencies = Record<string, never>>(
  variant: string,
  options: ComponentOptions<TProps, TDependencies, RawHtml> | FieldComponentOptions<TProps, TDependencies, RawHtml>,
): ForgeComponent<TProps, TDependencies, string> | ForgeFieldComponent<TProps, TDependencies, string> {
  if ('field' in options) {
    const { factory, ...componentOptions } = options

    return component<TProps, TDependencies, string>(variant, {
      ...componentOptions,
      factory: dependencies => {
        const evaluate = factory(dependencies)

        return async input => String(await evaluate(input))
      },
    })
  }

  const { factory, ...componentOptions } = options

  return component<TProps, TDependencies, string>(variant, {
    ...componentOptions,
    factory: dependencies => {
      const evaluate = factory(dependencies)

      return async input => String(await evaluate(input))
    },
  })
}
