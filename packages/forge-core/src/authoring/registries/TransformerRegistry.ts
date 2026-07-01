/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TransformerFunctionExpr } from '../types/expressions.type'
import { FunctionType } from '../types/enums'
import BaseFunctionRegistry, { type RegistrationOptions } from './BaseFunctionRegistry'

export default class TransformerRegistry<TDeps = Record<string, never>> extends BaseFunctionRegistry<TDeps> {
  constructor() {
    super(FunctionType.TRANSFORMER)
  }

  register<TArgs extends any[]>(
    name: string,
    options: RegistrationOptions,
    factory: (deps: TDeps) => (value: any, ...args: TArgs) => any,
  ): (...args: TArgs) => TransformerFunctionExpr

  register<TArgs extends any[]>(
    name: string,
    factory: (deps: TDeps) => (value: any, ...args: TArgs) => any,
  ): (...args: TArgs) => TransformerFunctionExpr

  register<TArgs extends any[]>(
    options: RegistrationOptions,
    factory: (deps: TDeps) => (value: any, ...args: TArgs) => any,
  ): (...args: TArgs) => TransformerFunctionExpr

  register<TArgs extends any[]>(
    factory: (deps: TDeps) => (value: any, ...args: TArgs) => any,
  ): (...args: TArgs) => TransformerFunctionExpr

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
