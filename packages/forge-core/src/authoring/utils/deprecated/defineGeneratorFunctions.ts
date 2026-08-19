import { FunctionEvaluator } from '../../types/functions.type'
import { ResolvableValue } from '../../types/expressions.type'
import { FunctionType } from '../../types/enums'
import { GeneratorBuilder } from '../../builders/GeneratorBuilder'
import { ForgeDeprecations } from '../../../shared/ForgeDeprecations'
import { extractPrepare, tagFunctionType } from './defineFunction'
import type {
  FunctionImplementations,
  FunctionShapeMap,
  GeneratorFunctionGroup,
  GeneratorFunctions,
  GeneratorImplementations,
  ImplementationShapes,
  NoDeps,
} from './defineFunction.type'

type GeneratorArguments<TFunction extends FunctionEvaluator<unknown>> =
  Parameters<TFunction> extends ResolvableValue[] ? Parameters<TFunction> : never

/**
 * Creates generator functions with dependency injection from factory functions.
 *
 * This separates builder creation from registry creation:
 * - `generators`: Available immediately for use in form definitions (no deps needed)
 * - `implementations`: Passed to `createFunctionsRegistry` at runtime with real dependencies
 *
 * Unlike conditions, transformers, and effects, generators do not receive a runtime
 * `value` or `context` parameter - their evaluators are called directly with just
 * the configuration arguments. The returned builders create `GeneratorBuilder` instances
 * that support chaining via `.pipe()`.
 *
 * Each factory entry can be a plain factory function or `{ prepare?, factory }`. When
 * `prepare` is provided, it runs synchronously when the author calls the builder —
 * sanitising/reshaping arguments before they enter the expression tree, and/or
 * throwing to reject invalid arguments at module-load time rather than at render time.
 *
 * @deprecated Use GeneratorRegistry instead.
 *
 * @param factories - Generator factories keyed by function name
 *
 * @returns Object containing generator builders and implementations
 *
 * @example
 * const { generators, implementations } = defineGeneratorFunctions({
 *   Today: () => () => new Date().toISOString().split('T')[0],
 *   PrefixedId: () => (prefix: string) => `${prefix}${crypto.randomUUID()}`,
 * })
 *
 * // With author-time preparation:
 * const { generators } = defineGeneratorFunctions<{ Slug: (input: string) => string }>({
 *   Slug: {
 *     prepare: (input) => {
 *       if (!input) throw new Error('input required')
 *       return [input]
 *     },
 *     factory: () => (input) => input.toLowerCase().replace(/\s+/g, '-'),
 *   },
 * })
 *
 * // Use in form definitions (returns GeneratorBuilder for chaining)
 * generators.PrefixedId('user-').pipe(transformers.ToUpperCase())
 *
 * // Create registry at runtime
 * const registry = createFunctionsRegistry(implementations)
 */
export function defineGeneratorFunctions<TShapes extends FunctionShapeMap, TDeps = NoDeps>(
  factories: FunctionImplementations<TShapes, TDeps>,
): {
  generators: GeneratorFunctions<TShapes>
  implementations: FunctionImplementations<TShapes, TDeps>
}
export function defineGeneratorFunctions<TGenerators extends GeneratorFunctionGroup<TGenerators>, TDeps = NoDeps>(
  factories: GeneratorImplementations<TGenerators, TDeps>,
): {
  generators: TGenerators
  implementations: FunctionImplementations<ImplementationShapes<'generator', TGenerators>, TDeps>
}
export function defineGeneratorFunctions<TShapes extends FunctionShapeMap, TDeps = NoDeps>(
  factories: Record<string, unknown>,
): {
  generators: GeneratorFunctions<TShapes>
  implementations: FunctionImplementations<TShapes, TDeps>
} {
  ForgeDeprecations.warn(
    'FORGE_DEP_defineGeneratorFunctions',
    'defineGeneratorFunctions is deprecated - use GeneratorRegistry instead.',
  )

  const generators = {} as GeneratorFunctions<TShapes>

  Object.keys(factories).forEach(name => {
    const key = name as keyof TShapes & string
    const prepare = extractPrepare(factories[key])
    generators[key] = ((...args: GeneratorArguments<TShapes[typeof key]>) => {
      const prepared = prepare ? prepare(...args) : args

      return GeneratorBuilder.create(name, prepared as GeneratorArguments<TShapes[typeof key]>)
    }) as GeneratorFunctions<TShapes>[typeof key]
  })

  return {
    generators,
    implementations: tagFunctionType(factories, FunctionType.GENERATOR) as unknown as FunctionImplementations<
      TShapes,
      TDeps
    >,
  }
}
