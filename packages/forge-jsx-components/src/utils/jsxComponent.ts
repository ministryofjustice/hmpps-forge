import { component } from '@ministryofjustice/hmpps-forge/core/components'
import type {
  ComponentRenderProps,
  ComponentOptions,
  FieldComponentRenderProps,
  FieldComponentOptions,
  ForgeComponent,
  ForgeFieldComponent,
} from '@ministryofjustice/hmpps-forge/core/components'

import type { RawHtml } from '../runtime/jsx-runtime'

type MaybePromise<T> = T | PromiseLike<T>

type JSXComponentOptions<TProps extends object, TDeps> = Omit<ComponentOptions<TProps, TDeps>, 'factory'> & {
  readonly factory: (deps: TDeps) => (props: ComponentRenderProps<TProps>) => MaybePromise<RawHtml>
}

type JSXFieldComponentOptions<TProps extends object, TDeps> = Omit<FieldComponentOptions<TProps, TDeps>, 'factory'> & {
  readonly factory: (deps: TDeps) => (props: FieldComponentRenderProps<TProps>) => MaybePromise<RawHtml>
}

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
 *     async props => {
 *       const caseDetails = await cases.get(props.caseReference)
 *
 *       return <h1>{caseDetails.title}</h1>
 *     },
 * })
 * ```
 */
export function jsxComponent<TProps extends object, TDeps = Record<string, never>>(
  variant: string,
  options: JSXFieldComponentOptions<TProps, TDeps>,
): ForgeFieldComponent<TProps, TDeps>
export function jsxComponent<TProps extends object, TDeps = Record<string, never>>(
  variant: string,
  options: JSXComponentOptions<TProps, TDeps>,
): ForgeComponent<TProps, TDeps>
export function jsxComponent<TProps extends object, TDeps = Record<string, never>>(
  variant: string,
  options: JSXComponentOptions<TProps, TDeps> | JSXFieldComponentOptions<TProps, TDeps>,
): ForgeComponent<TProps, TDeps> | ForgeFieldComponent<TProps, TDeps> {
  if ('field' in options) {
    const { factory, ...componentOptions } = options

    return component<TProps, TDeps>(variant, {
      ...componentOptions,
      factory: dependencies => {
        const evaluate = factory(dependencies)

        return async props => String(await evaluate(props))
      },
    })
  }

  const { factory, ...componentOptions } = options

  return component<TProps, TDeps>(variant, {
    ...componentOptions,
    factory: dependencies => {
      const evaluate = factory(dependencies)

      return async props => String(await evaluate(props))
    },
  })
}
