import { FunctionEvaluator } from '../types/functions.type'
import { ValueExpr } from '../types/expressions.type'
import { GeneratorBuilder } from '../builders/GeneratorBuilder'
import type {
  FunctionImplementations,
  FunctionShapeMap,
  GeneratorFunctionGroup,
  GeneratorFunctions,
  GeneratorImplementations,
  NoDeps,
} from './defineFunction.type'

type GeneratorArguments<TFunction extends FunctionEvaluator<unknown>> =
  Parameters<TFunction> extends ValueExpr[] ? Parameters<TFunction> : never

/**
 * Creates generator functions with dependency injection from factory functions.
 *
 * This separates builder creation from registry creation:
 * - `generators`: Available immediately for use in form definitions (no deps needed)
 * - `implementations`: Passed to `createFunctionsRegistry` at runtime with real dependencies
 *
 * Unlike conditions, transformers, and effects, generators do not receive a runtime
 * `value` or `context` parameter — their evaluators are called directly with just
 * the configuration arguments. The returned builders create `GeneratorBuilder` instances
 * that support chaining via `.pipe()`.
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
  implementations: GeneratorImplementations<TGenerators, TDeps>
}
export function defineGeneratorFunctions<TShapes extends FunctionShapeMap, TDeps = NoDeps>(
  factories: FunctionImplementations<TShapes, TDeps>,
): {
  generators: GeneratorFunctions<TShapes>
  implementations: FunctionImplementations<TShapes, TDeps>
} {
  const generators = {} as GeneratorFunctions<TShapes>

  Object.keys(factories).forEach(name => {
    const key = name as keyof TShapes & string
    generators[key] = ((...args: GeneratorArguments<TShapes[typeof key]>) => {
      return GeneratorBuilder.create(name, args)
    }) as GeneratorFunctions<TShapes>[typeof key]
  })

  return { generators, implementations: factories }
}
