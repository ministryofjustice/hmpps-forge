import { FunctionCallType } from '../../shared/taxonomy'
import { GeneratorBuilder } from '../builders/GeneratorBuilder'
import { captureCallsite, stampCallsite } from '../builders/utils/captureCallsite'
import { stampEntry } from '../builders/utils/stampEntry'
import { createEntry } from './createEntry'
import type { BaseEntryOptions, CallResultBuilder } from './createEntry'
import type { ChainableGenerator } from '../builders/types'
import type { Resolvable, ResolvableValue } from '../types/expressions.type'
import type { FunctionEntry } from '../types/functions.type'

/**
 * The options `generator()` accepts. Generators produce values without
 * input, so there is no `inputSchema`.
 *
 * @typeParam TDeps - The dependencies the factory receives at build time
 * @typeParam TEvaluatorArguments - The evaluator's parameters, as the author annotates them
 * @typeParam TPrepareArguments - The parameters `prepare` declares, which become the entry's call signature when present
 */
export interface GeneratorOptions<
  TDeps,
  TEvaluatorArguments extends any[] = any[],
  TPrepareArguments extends any[] = TEvaluatorArguments,
> extends BaseEntryOptions<TPrepareArguments> {
  /** Builds one request's evaluator from its resolved dependencies. */
  factory: (deps: TDeps) => (...args: TEvaluatorArguments) => unknown
}

/**
 * What `generator()` returns: a callable that takes the arguments you pass and
 * returns a chainable builder supporting `.pipe()`, `.match()`, and `.not`. Using
 * it in a journey registers the function automatically.
 *
 * @typeParam TDeps - The dependencies the factory receives
 * @typeParam TAuthoredArguments - The arguments the callable accepts, each widened to `Resolvable`
 */
export type GeneratorEntry<
  TDeps = Record<string, never>,
  TAuthoredArguments extends readonly unknown[] = ResolvableValue[],
> = ((...args: TAuthoredArguments) => ChainableGenerator) & Omit<FunctionEntry<TDeps>, 'inputSchema'>

// Generator handles return a builder, matching registry handles, so authors can
// chain `.pipe()`/`.match()`/`.not`. Stamps go on the builder AND its inner
// expression: `.pipe()` and `.match()` embed the raw expression directly,
// bypassing the builder that finalisation would otherwise carry stamps from.
const buildGeneratorHandle: CallResultBuilder = (name, prepared, entry) => {
  const builder = GeneratorBuilder.create(name, prepared)
  const callsite = captureCallsite(entry)

  stampCallsite(builder, callsite)
  stampEntry(builder, entry)
  stampCallsite(builder.expr, callsite)
  stampEntry(builder.expr, entry)
  return builder
}

/**
 * Defines a generator function as a standalone entry. Use the result in a journey
 * definition and it registers itself - no registry or `functions` listing needed:
 *
 * ```typescript
 * export const Tomorrow = generator('Date.Tomorrow', {
 *   factory: deps => () => deps.clock.tomorrow(),
 * })
 *
 * // In a journey definition:
 * Tomorrow().pipe(Transformer.Date.Format('YYYY-MM-DD'))
 * ```
 *
 * Generators produce a value from nothing, so the evaluator receives only the
 * arguments from the call site, and calling the entry returns a chainable builder
 * rather than a plain expression. The evaluator's annotations set the types: its
 * parameters become the call signature, and each one also accepts an expression
 * such as a reference. `prepare`'s parameters take over as the call signature when
 * one is given. The schemas validate at runtime and play no part in typing.
 *
 * @param name - The generator's name, used in error messages and diagnostics
 * @param options - The schemas, argument preparation, and evaluator factory
 * @returns The generator entry - call it with arguments in a journey definition
 */
export function generator<
  TDeps = Record<string, never>,
  TEvaluatorArguments extends any[] = any[],
  TPrepareArguments extends any[] = TEvaluatorArguments,
>(
  name: string,
  options: GeneratorOptions<TDeps, TEvaluatorArguments, TPrepareArguments>,
): GeneratorEntry<TDeps, { [K in keyof TPrepareArguments]: Resolvable<TPrepareArguments[K]> }>
export function generator<
  TDeps = Record<string, never>,
  TEvaluatorArguments extends any[] = any[],
  TPrepareArguments extends any[] = TEvaluatorArguments,
>(
  options: GeneratorOptions<TDeps, TEvaluatorArguments, TPrepareArguments>,
): GeneratorEntry<TDeps, { [K in keyof TPrepareArguments]: Resolvable<TPrepareArguments[K]> }>
export function generator(
  first: string | GeneratorOptions<any, any, any>,
  second?: GeneratorOptions<any, any, any>,
): GeneratorEntry<any, any> {
  return createEntry(FunctionCallType.GENERATOR, 'generator', first, second, buildGeneratorHandle)
}
