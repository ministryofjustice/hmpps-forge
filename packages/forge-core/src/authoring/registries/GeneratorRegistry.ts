import type { Resolvable } from '../types/expressions.type'
import type { ChainableGenerator } from '../builders/types'
import { FunctionCallType } from '../../shared/taxonomy'
import { BaseFunctionRegistry, type RegistrationOptions } from './BaseFunctionRegistry'

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
