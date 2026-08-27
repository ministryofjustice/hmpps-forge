import { FunctionCallType } from '../types/enums'
import { buildExpression, createEntry } from './createEntry'
import type { BaseEntryOptions } from './createEntry'
import type { EffectFunctionExpr, Resolvable, ResolvableValue } from '../types/expressions.type'
import type { EffectFunctionContext } from '../../engine/chassis/runtime/context/EffectFunctionContext'
import type { FunctionEntry } from '../types/functions.type'

/**
 * The effect evaluator's first parameter. `any` type arguments so authors can
 * annotate a narrower context (e.g. `EffectFunctionContext<MyData>`) without
 * tripping contravariance checks.
 */
export type EffectContext = EffectFunctionContext<any, any, any, any>

/**
 * The options `effect()` accepts. Effects receive the hook's context
 * object rather than a schema-validated value, so there is no `inputSchema`.
 *
 * @typeParam TDeps - The dependencies the factory receives at build time
 * @typeParam TEvaluatorArguments - The evaluator's trailing parameters, as the author annotates them
 * @typeParam TPrepareArguments - The parameters `prepare` declares, which become the entry's call signature when present
 */
export interface EffectOptions<
  TDeps,
  TEvaluatorArguments extends any[] = any[],
  TPrepareArguments extends any[] = TEvaluatorArguments,
> extends BaseEntryOptions<TPrepareArguments> {
  /** Builds the evaluator from the dependencies supplied at registration time. */
  factory: (deps: TDeps) => (context: EffectContext, ...args: TEvaluatorArguments) => unknown
}

/**
 * What `effect()` returns: a callable that builds an effect expression from the
 * arguments you pass, for use in hook `effects` lists. Using it in a journey
 * registers the function automatically.
 *
 * @typeParam TDeps - The dependencies the factory receives
 * @typeParam TAuthoredArguments - The arguments the callable accepts, each widened to `Resolvable`
 */
export type EffectEntry<
  TDeps = Record<string, never>,
  TAuthoredArguments extends readonly unknown[] = ResolvableValue[],
> = ((...args: TAuthoredArguments) => EffectFunctionExpr) & FunctionEntry<TDeps>

const buildEffectExpr = buildExpression(FunctionCallType.EFFECT)

/**
 * Defines an effect function as a standalone entry. Use the result in a journey
 * definition and it registers itself - no registry or `functions` listing needed:
 *
 * ```typescript
 * export const SaveDraft = effect('Draft.Save', {
 *   factory: deps => async context => {
 *     await deps.api.save(context.getAllAnswers())
 *   },
 * })
 *
 * // In a journey definition:
 * submit({ validate: true, onValid: { effects: [SaveDraft()] } })
 * ```
 *
 * Effects run during lifecycle hooks, so the evaluator receives the hook's
 * {@link EffectFunctionContext} first, then the arguments from the call site. Its
 * annotations set the types: parameters after `context` become the call signature,
 * and each one also accepts an expression such as a reference. `prepare`'s
 * parameters take over as the call signature when one is given. The schemas
 * validate at runtime and play no part in typing.
 *
 * @param name - The effect's name, used in error messages and diagnostics
 * @param options - The schemas, argument preparation, and evaluator factory
 * @returns The effect entry - call it with arguments in a journey definition
 */
export function effect<
  TDeps = Record<string, never>,
  TEvaluatorArguments extends any[] = any[],
  TPrepareArguments extends any[] = TEvaluatorArguments,
>(
  name: string,
  options: EffectOptions<TDeps, TEvaluatorArguments, TPrepareArguments>,
): EffectEntry<TDeps, { [K in keyof TPrepareArguments]: Resolvable<TPrepareArguments[K]> }>
export function effect<
  TDeps = Record<string, never>,
  TEvaluatorArguments extends any[] = any[],
  TPrepareArguments extends any[] = TEvaluatorArguments,
>(
  options: EffectOptions<TDeps, TEvaluatorArguments, TPrepareArguments>,
): EffectEntry<TDeps, { [K in keyof TPrepareArguments]: Resolvable<TPrepareArguments[K]> }>
export function effect(
  first: string | EffectOptions<any, any, any>,
  second?: EffectOptions<any, any, any>,
): EffectEntry<any, any> {
  return createEntry(FunctionCallType.EFFECT, 'effect', first, second, buildEffectExpr)
}
