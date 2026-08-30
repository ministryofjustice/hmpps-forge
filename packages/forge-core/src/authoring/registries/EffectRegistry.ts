import type { EffectFunctionExpr, Resolvable } from '../types/expressions.type'
import { FunctionCallType } from '../../shared/taxonomy'
import { BaseFunctionRegistry, type EffectRegistrationOptions, type RegistrationOptions } from './BaseFunctionRegistry'

/**
 * @deprecated Use `effect()` to define each effect as a standalone entry:
 *
 * ```typescript
 * const SaveCase = effect<Dependencies>('SaveCase', {
 *   factory: dependencies => async (context, caseId: string) => {
 *     await dependencies.api.saveCase(caseId, context.getAllAnswers())
 *   },
 * })
 *
 * submit({ validate: true, onValid: { effects: [SaveCase(Params('caseId'))] } })
 * ```
 *
 * You don't need to register the effect or add it to the package. Just use `SaveCase()` in your
 * journey and Forge will pick it up. If your journey is JSON and refers to the effect only by name,
 * add it with `functions: [SaveCase]`.
 */
export default class EffectRegistry<TDeps = Record<string, never>> extends BaseFunctionRegistry<TDeps> {
  constructor() {
    super(FunctionCallType.EFFECT)
  }

  register<TArgs extends any[]>(
    name: string,
    options: EffectRegistrationOptions & { factory: (deps: TDeps) => (context: any, ...args: TArgs) => any },
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => EffectFunctionExpr

  register<TArgs extends any[]>(
    name: string,
    options: EffectRegistrationOptions,
    factory: (deps: TDeps) => (context: any, ...args: TArgs) => any,
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => EffectFunctionExpr

  register<TArgs extends any[]>(
    name: string,
    factory: (deps: TDeps) => (context: any, ...args: TArgs) => any,
  ): (...args: { [K in keyof TArgs]: Resolvable<TArgs[K]> }) => EffectFunctionExpr

  register<TArgs extends any[]>(
    options: EffectRegistrationOptions,
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
