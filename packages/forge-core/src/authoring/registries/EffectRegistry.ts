/* eslint-disable @typescript-eslint/no-explicit-any */
import type { EffectFunctionExpr } from '../types/expressions.type'
import { FunctionType } from '../types/enums'
import BaseFunctionRegistry, { type RegistrationOptions } from './BaseFunctionRegistry'

export default class EffectRegistry<TDeps = Record<string, never>> extends BaseFunctionRegistry<TDeps> {
  constructor() {
    super(FunctionType.EFFECT)
  }

  register<TArgs extends any[]>(
    name: string,
    options: RegistrationOptions,
    factory: (deps: TDeps) => (context: any, ...args: TArgs) => any,
  ): (...args: TArgs) => EffectFunctionExpr

  register<TArgs extends any[]>(
    name: string,
    factory: (deps: TDeps) => (context: any, ...args: TArgs) => any,
  ): (...args: TArgs) => EffectFunctionExpr

  register<TArgs extends any[]>(
    options: RegistrationOptions,
    factory: (deps: TDeps) => (context: any, ...args: TArgs) => any,
  ): (...args: TArgs) => EffectFunctionExpr

  register<TArgs extends any[]>(
    factory: (deps: TDeps) => (context: any, ...args: TArgs) => any,
  ): (...args: TArgs) => EffectFunctionExpr

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
