import type { ConditionFunctionExpr, Resolvable } from '../types/expressions.type'
import { FunctionCallType } from '../../shared/taxonomy'
import { BaseFunctionRegistry, CONDITION_OUTPUT_SCHEMA, type RegistrationOptions } from './BaseFunctionRegistry'

/**
 * @deprecated Use `condition()` to define each condition as a standalone entry:
 *
 * ```typescript
 * const IsAllowed = condition<Dependencies>('IsAllowed', {
 *   factory: dependencies => (value: string) => dependencies.allowedValues.includes(value),
 * })
 *
 * Self().match(IsAllowed())
 * ```
 *
 * You don't need to register the condition or add it to the package. Just use `IsAllowed()` in your
 * journey and Forge will pick it up. If your journey is JSON and refers to the condition only by
 * name, add it with `functions: [IsAllowed]`.
 */
export default class ConditionRegistry<TDeps = Record<string, never>> extends BaseFunctionRegistry<TDeps> {
  constructor() {
    super(FunctionCallType.CONDITION, CONDITION_OUTPUT_SCHEMA)
  }

  register<TArgs extends any[]>(
    name: string,
    options: RegistrationOptions & { factory: (deps: TDeps) => (value: any, ...args: TArgs) => boolean },
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => ConditionFunctionExpr

  register<TArgs extends any[]>(
    name: string,
    options: RegistrationOptions,
    factory: (deps: TDeps) => (value: any, ...args: TArgs) => boolean,
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => ConditionFunctionExpr

  register<TArgs extends any[]>(
    name: string,
    factory: (deps: TDeps) => (value: any, ...args: TArgs) => boolean,
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => ConditionFunctionExpr

  register<TArgs extends any[]>(
    options: RegistrationOptions,
    factory: (deps: TDeps) => (value: any, ...args: TArgs) => boolean,
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => ConditionFunctionExpr

  register<TArgs extends any[]>(
    factory: (deps: TDeps) => (value: any, ...args: TArgs) => boolean,
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => ConditionFunctionExpr

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
