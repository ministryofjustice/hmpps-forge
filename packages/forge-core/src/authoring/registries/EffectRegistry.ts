import type { EffectFunctionExpr, Resolvable } from '../types/expressions.type'
import { FunctionCallType } from '../types/enums'
import { BaseFunctionRegistry, type RegistrationOptions } from './BaseFunctionRegistry'

export default class EffectRegistry<TDeps = Record<string, never>> extends BaseFunctionRegistry<TDeps> {
  constructor() {
    super(FunctionCallType.EFFECT)
  }

  register<TArgs extends any[]>(
    name: string,
    options: RegistrationOptions & { factory: (deps: TDeps) => (context: any, ...args: TArgs) => any },
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => EffectFunctionExpr

  register<TArgs extends any[]>(
    name: string,
    options: RegistrationOptions,
    factory: (deps: TDeps) => (context: any, ...args: TArgs) => any,
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => EffectFunctionExpr

  register<TArgs extends any[]>(
    name: string,
    factory: (deps: TDeps) => (context: any, ...args: TArgs) => any,
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => EffectFunctionExpr

  register<TArgs extends any[]>(
    options: RegistrationOptions,
    factory: (deps: TDeps) => (context: any, ...args: TArgs) => any,
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => EffectFunctionExpr

  register<TArgs extends any[]>(
    factory: (deps: TDeps) => (context: any, ...args: TArgs) => any,
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => EffectFunctionExpr

  register(
    first: string | RegistrationOptions | ((deps: TDeps) => (...args: any[]) => any),
    second?: RegistrationOptions | ((deps: TDeps) => (...args: any[]) => any),
    third?: (deps: TDeps) => (...args: any[]) => any,
  ): (...args: any[]) => EffectFunctionExpr {
    const { name, options, factory } = this.parseArgs(first, second, third)

    this.store(name, options, factory)

    return this.buildExpressionHandle(name, options.prepare) as any
  }
}
