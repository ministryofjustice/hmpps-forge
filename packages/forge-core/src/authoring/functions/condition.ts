import type { ZodType } from 'zod'
import { FunctionCallType } from '../../shared/taxonomy'
import { buildExpression, createEntry } from './createEntry'
import type { BaseEntryOptions } from './createEntry'
import type { ConditionFunctionExpr, Resolvable, ResolvableValue } from '../types/expressions.type'
import type { FunctionEntry } from '../types/functions.type'

/**
 * The options `condition()` accepts.
 *
 * @typeParam TDeps - The dependencies the factory receives at build time
 * @typeParam TEvaluatorArguments - The evaluator's trailing parameters, as the author annotates them
 * @typeParam TPrepareArguments - The parameters `prepare` declares, which become the entry's call signature when present
 */
export interface ConditionOptions<
  TDeps,
  TEvaluatorArguments extends any[] = any[],
  TPrepareArguments extends any[] = TEvaluatorArguments,
> extends BaseEntryOptions<TPrepareArguments> {
  /** Validates the value under test at runtime before the evaluator runs. */
  inputSchema?: ZodType

  /** Validates the evaluator's result at runtime. Conditions default to boolean downstream when omitted. */
  outputSchema?: ZodType

  /**
   * Builds one request's evaluator from the package dependencies.
   * `value` is declared `any` so the author can annotate the type they expect
   * without tripping contravariance checks.
   */
  factory: (deps: TDeps) => (value: any, ...args: TEvaluatorArguments) => boolean | Promise<boolean>
}

/**
 * What `condition()` returns: a callable that builds a condition expression from the
 * arguments you pass, for use with `.match()` and `when()`. Using it in a journey
 * registers the function automatically.
 *
 * @typeParam TDeps - The dependencies the factory receives
 * @typeParam TAuthoredArguments - The arguments the callable accepts, each widened to `Resolvable`
 */
export type ConditionEntry<
  TDeps = Record<string, never>,
  TAuthoredArguments extends readonly unknown[] = ResolvableValue[],
> = ((...args: TAuthoredArguments) => ConditionFunctionExpr) & FunctionEntry<TDeps>

const buildConditionExpr = buildExpression(FunctionCallType.CONDITION)

/**
 * Defines a condition function as a standalone entry. Use the result in a journey
 * definition and it registers itself - no registry or `functions` listing needed:
 *
 * ```typescript
 * export const IsValidCrn = condition('Caseload.IsValidCrn', {
 *   inputSchema: z.string(),
 *   argumentsSchema: z.tuple([z.number()]),
 *   factory: deps => (value: string, min: number) => value.length >= min,
 * })
 *
 * // In a journey definition:
 * Self().match(IsValidCrn(5))
 * ```
 *
 * The evaluator receives the value under test first, then the arguments from the
 * call site. Its annotations set the types: parameters after `value` become the
 * call signature, and each one also accepts an expression such as a reference, so
 * `IsValidCrn(Answer('minimumLength'))` compiles too. `prepare`'s parameters take
 * over as the call signature when one is given. The schemas validate at runtime
 * and play no part in typing.
 *
 * @param name - The condition's name, used in error messages and diagnostics
 * @param options - The schemas, argument preparation, and evaluator factory
 * @returns The condition entry - call it with arguments in a journey definition
 */
export function condition<
  TDeps = Record<string, never>,
  TEvaluatorArguments extends any[] = any[],
  TPrepareArguments extends any[] = TEvaluatorArguments,
>(
  name: string,
  options: ConditionOptions<TDeps, TEvaluatorArguments, TPrepareArguments>,
): ConditionEntry<TDeps, { [K in keyof TPrepareArguments]: Resolvable<TPrepareArguments[K]> }>
export function condition<
  TDeps = Record<string, never>,
  TEvaluatorArguments extends any[] = any[],
  TPrepareArguments extends any[] = TEvaluatorArguments,
>(
  options: ConditionOptions<TDeps, TEvaluatorArguments, TPrepareArguments>,
): ConditionEntry<TDeps, { [K in keyof TPrepareArguments]: Resolvable<TPrepareArguments[K]> }>
export function condition(
  first: string | ConditionOptions<any, any, any>,
  second?: ConditionOptions<any, any, any>,
): ConditionEntry<any, any> {
  return createEntry(FunctionCallType.CONDITION, 'condition', first, second, buildConditionExpr)
}
