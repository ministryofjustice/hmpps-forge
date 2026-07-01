/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ConditionFunctionExpr } from '../types/expressions.type'
import { FunctionType } from '../types/enums'
import BaseFunctionRegistry, { CONDITION_OUTPUT_SCHEMA, type RegistrationOptions } from './BaseFunctionRegistry'

export default class ConditionRegistry<TDeps = Record<string, never>> extends BaseFunctionRegistry<TDeps> {
  constructor() {
    super(FunctionType.CONDITION, CONDITION_OUTPUT_SCHEMA)
  }

  register<TArgs extends any[]>(
    name: string,
    options: RegistrationOptions,
    factory: (deps: TDeps) => (value: any, ...args: TArgs) => boolean,
  ): (...args: TArgs) => ConditionFunctionExpr

  register<TArgs extends any[]>(
    name: string,
    factory: (deps: TDeps) => (value: any, ...args: TArgs) => boolean,
  ): (...args: TArgs) => ConditionFunctionExpr

  register<TArgs extends any[]>(
    options: RegistrationOptions,
    factory: (deps: TDeps) => (value: any, ...args: TArgs) => boolean,
  ): (...args: TArgs) => ConditionFunctionExpr

  register<TArgs extends any[]>(
    factory: (deps: TDeps) => (value: any, ...args: TArgs) => boolean,
  ): (...args: TArgs) => ConditionFunctionExpr

  register(
    first: string | RegistrationOptions | ((deps: TDeps) => (...args: any[]) => any),
    second?: RegistrationOptions | ((deps: TDeps) => (...args: any[]) => any),
    third?: (deps: TDeps) => (...args: any[]) => any,
  ): (...args: any[]) => ConditionFunctionExpr {
    const { name, options, factory } = this.parseArgs(first, second, third)

    this.store(name, options, factory)

    return this.buildExpressionHandle(name, options.prepare) as any
  }
}
