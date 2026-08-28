import type { ZodType } from 'zod'
import { FunctionCallType } from '../../shared/taxonomy'
import { buildExpression, createEntry } from './createEntry'
import type { BaseEntryOptions } from './createEntry'
import type { Resolvable, ResolvableValue, TransformerFunctionExpr } from '../types/expressions.type'
import type { FunctionEntry } from '../types/functions.type'

/**
 * The options `transformer()` accepts.
 *
 * @typeParam TDeps - The dependencies the factory receives at build time
 * @typeParam TEvaluatorArguments - The evaluator's trailing parameters, as the author annotates them
 * @typeParam TPrepareArguments - The parameters `prepare` declares, which become the entry's call signature when present
 */
export interface TransformerOptions<
  TDeps,
  TEvaluatorArguments extends any[] = any[],
  TPrepareArguments extends any[] = TEvaluatorArguments,
> extends BaseEntryOptions<TPrepareArguments> {
  /** Validates the value being transformed at runtime before the evaluator runs. */
  inputSchema?: ZodType

  /**
   * Builds the evaluator from the dependencies supplied at registration time.
   * `value` is declared `any` so the author can annotate the type they expect
   * without tripping contravariance checks.
   */
  factory: (deps: TDeps) => (value: any, ...args: TEvaluatorArguments) => unknown
}

/**
 * What `transformer()` returns: a callable that builds a transformer expression from
 * the arguments you pass, for use with `.pipe()`. Using it in a journey registers
 * the function automatically.
 *
 * @typeParam TDeps - The dependencies the factory receives
 * @typeParam TAuthoredArguments - The arguments the callable accepts, each widened to `Resolvable`
 */
export type TransformerEntry<
  TDeps = Record<string, never>,
  TAuthoredArguments extends readonly unknown[] = ResolvableValue[],
> = ((...args: TAuthoredArguments) => TransformerFunctionExpr) & FunctionEntry<TDeps>

const buildTransformerExpr = buildExpression(FunctionCallType.TRANSFORMER)

/**
 * Defines a transformer function as a standalone entry. Use the result in a journey
 * definition and it registers itself - no registry or `functions` listing needed:
 *
 * ```typescript
 * export const Truncate = transformer('Text.Truncate', {
 *   inputSchema: z.string(),
 *   argumentsSchema: z.tuple([z.number()]),
 *   factory: deps => (value: string, max: number) => value.slice(0, max),
 * })
 *
 * // In a journey definition:
 * Answer('summary').pipe(Truncate(20))
 * ```
 *
 * The evaluator receives the piped value first, then the arguments from the call
 * site. Its annotations set the types: parameters after `value` become the call
 * signature, and each one also accepts an expression such as a reference, so
 * `Truncate(Answer('maxLength'))` compiles too. `prepare`'s parameters take over
 * as the call signature when one is given. The schemas validate at runtime and
 * play no part in typing.
 *
 * @param name - The transformer's name, used in error messages and diagnostics
 * @param options - The schemas, argument preparation, and evaluator factory
 * @returns The transformer entry - call it with arguments in a journey definition
 */
export function transformer<
  TDeps = Record<string, never>,
  TEvaluatorArguments extends any[] = any[],
  TPrepareArguments extends any[] = TEvaluatorArguments,
>(
  name: string,
  options: TransformerOptions<TDeps, TEvaluatorArguments, TPrepareArguments>,
): TransformerEntry<TDeps, { [K in keyof TPrepareArguments]: Resolvable<TPrepareArguments[K]> }>
export function transformer<
  TDeps = Record<string, never>,
  TEvaluatorArguments extends any[] = any[],
  TPrepareArguments extends any[] = TEvaluatorArguments,
>(
  options: TransformerOptions<TDeps, TEvaluatorArguments, TPrepareArguments>,
): TransformerEntry<TDeps, { [K in keyof TPrepareArguments]: Resolvable<TPrepareArguments[K]> }>
export function transformer(
  first: string | TransformerOptions<any, any, any>,
  second?: TransformerOptions<any, any, any>,
): TransformerEntry<any, any> {
  return createEntry(FunctionCallType.TRANSFORMER, 'transformer', first, second, buildTransformerExpr)
}
