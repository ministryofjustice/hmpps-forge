import type { Resolvable } from '../types/expressions.type'
import type { ChainableGenerator } from '../builders/types'
import { FunctionCallType } from '../../shared/taxonomy'
import { BaseFunctionRegistry, type RegistrationOptions } from './BaseFunctionRegistry'

/**
 * @deprecated Use `generator()` to define each generator as a standalone entry:
 *
 * ```typescript
 * const LoadCase = generator<Dependencies>('LoadCase', {
 *   factory: dependencies => async (caseId: string) => dependencies.api.loadCase(caseId),
 * })
 *
 * LoadCase(Params('caseId'))
 * ```
 *
 * You don't need to register the generator or add it to the package. Just use `LoadCase()` in your
 * journey and Forge will pick it up. If your journey is JSON and refers to the generator only by
 * name, add it with `functions: [LoadCase]`.
 */
export default class GeneratorRegistry<TDeps = Record<string, never>> extends BaseFunctionRegistry<TDeps> {
  constructor() {
    super(FunctionCallType.GENERATOR)
  }

  register<TArgs extends any[]>(
    name: string,
    options: RegistrationOptions & { factory: (deps: TDeps) => (...args: TArgs) => any },
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => ChainableGenerator

  register<TArgs extends any[]>(
    name: string,
    options: RegistrationOptions,
    factory: (deps: TDeps) => (...args: TArgs) => any,
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => ChainableGenerator

  register<TArgs extends any[]>(
    name: string,
    factory: (deps: TDeps) => (...args: TArgs) => any,
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => ChainableGenerator

  register<TArgs extends any[]>(
    options: RegistrationOptions,
    factory: (deps: TDeps) => (...args: TArgs) => any,
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => ChainableGenerator

  register<TArgs extends any[]>(
    factory: (deps: TDeps) => (...args: TArgs) => any,
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => ChainableGenerator

  register(
    first: string | RegistrationOptions | ((deps: TDeps) => (...args: any[]) => any),
    second?: RegistrationOptions | ((deps: TDeps) => (...args: any[]) => any),
    third?: (deps: TDeps) => (...args: any[]) => any,
  ): (...args: any[]) => ChainableGenerator {
    const { name, options, factory } = this.parseArgs(first, second, third)

    this.store(name, options, factory)

    return this.buildExpressionHandle(name, options.prepare) as any
  }
}
