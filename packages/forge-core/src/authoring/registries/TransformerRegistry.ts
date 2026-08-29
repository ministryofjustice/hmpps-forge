import type { Resolvable, TransformerFunctionExpr } from '../types/expressions.type'
import { FunctionCallType } from '../../shared/taxonomy'
import { BaseFunctionRegistry, type RegistrationOptions } from './BaseFunctionRegistry'

/**
 * @deprecated Use `transformer()` to define each transformer as a standalone entry:
 *
 * ```typescript
 * const NormaliseName = transformer<Dependencies>('NormaliseName', {
 *   factory: dependencies => (value: string) => dependencies.names.normalise(value),
 * })
 *
 * Answer('name').pipe(NormaliseName())
 * ```
 *
 * You don't need to register the transformer or add it to the package. Just use `NormaliseName()`
 * in your journey and Forge will pick it up. If your journey is JSON and refers to the transformer
 * only by name, add it with `functions: [NormaliseName]`.
 */
export default class TransformerRegistry<TDeps = Record<string, never>> extends BaseFunctionRegistry<TDeps> {
  constructor() {
    super(FunctionCallType.TRANSFORMER)
  }

  register<TArgs extends any[]>(
    name: string,
    options: RegistrationOptions & { factory: (deps: TDeps) => (value: any, ...args: TArgs) => any },
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => TransformerFunctionExpr

  register<TArgs extends any[]>(
    name: string,
    options: RegistrationOptions,
    factory: (deps: TDeps) => (value: any, ...args: TArgs) => any,
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => TransformerFunctionExpr

  register<TArgs extends any[]>(
    name: string,
    factory: (deps: TDeps) => (value: any, ...args: TArgs) => any,
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => TransformerFunctionExpr

  register<TArgs extends any[]>(
    options: RegistrationOptions,
    factory: (deps: TDeps) => (value: any, ...args: TArgs) => any,
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => TransformerFunctionExpr

  register<TArgs extends any[]>(
    factory: (deps: TDeps) => (value: any, ...args: TArgs) => any,
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => TransformerFunctionExpr

  register(
    first: string | RegistrationOptions | ((deps: TDeps) => (...args: any[]) => any),
    second?: RegistrationOptions | ((deps: TDeps) => (...args: any[]) => any),
    third?: (deps: TDeps) => (...args: any[]) => any,
  ): (...args: any[]) => TransformerFunctionExpr {
    const { name, options, factory } = this.parseArgs(first, second, third)

    this.store(name, options, factory)

    return this.buildExpressionHandle(name, options.prepare) as any
  }
}
