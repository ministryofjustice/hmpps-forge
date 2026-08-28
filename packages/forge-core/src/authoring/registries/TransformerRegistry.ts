import type { Resolvable, TransformerFunctionExpr } from '../types/expressions.type'
import { FunctionCallType } from '../../shared/taxonomy'
import { BaseFunctionRegistry, type RegistrationOptions } from './BaseFunctionRegistry'

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
