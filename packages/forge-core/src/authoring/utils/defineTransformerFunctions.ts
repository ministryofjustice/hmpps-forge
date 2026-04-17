import { FunctionType } from '../types/enums'
import { buildExpressionFunctions, extractFactories } from './defineFunction'
import type {
  FunctionImplementations,
  FunctionShapeMap,
  NoDeps,
  TransformerFunctionGroup,
  TransformerFunctions,
  TransformerImplementations,
} from './defineFunction.type'

/**
 * Creates transformer functions with dependency injection from factory functions.
 *
 * This separates builder creation from registry creation:
 * - `transformers`: Available immediately for use in form definitions (no deps needed)
 * - `implementations`: Passed to `createFunctionsRegistry` at runtime with real dependencies
 *
 * Each transformer factory receives dependencies and returns an evaluator function.
 * The evaluator's first parameter (`value`) is injected by the engine at runtime -
 * the returned `transformers` builders only expose the remaining configuration arguments.
 *
 * @param factories - Transformer factories keyed by function name
 *
 * @returns Object containing transformer builders and implementations
 *
 * @example
 * const { transformers, implementations } = defineTransformerFunctions({
 *   AddPrefix: () => (value: unknown, prefix: string) => `${prefix}${String(value)}`,
 * })
 *
 * // Use in form definitions
 * transformers.AddPrefix('Mr ')  // { type: 'transformer', name: 'AddPrefix', arguments: ['Mr '] }
 *
 * // Create registry at runtime
 * const registry = createFunctionsRegistry(implementations)
 */
export function defineTransformerFunctions<TShapes extends FunctionShapeMap, TDeps = NoDeps>(
  factories: FunctionImplementations<TShapes, TDeps>,
): {
  transformers: TransformerFunctions<TShapes>
  implementations: FunctionImplementations<TShapes, TDeps>
}
export function defineTransformerFunctions<
  TTransformers extends TransformerFunctionGroup<TTransformers>,
  TDeps = NoDeps,
>(
  factories: TransformerImplementations<TTransformers, TDeps>,
): {
  transformers: TTransformers
  implementations: FunctionImplementations<{ [K in keyof TTransformers]: TTransformers[K] }, TDeps>
}
export function defineTransformerFunctions<TShapes extends FunctionShapeMap, TDeps = NoDeps>(
  factories: Record<string, unknown>,
): {
  transformers: TransformerFunctions<TShapes>
  implementations: FunctionImplementations<TShapes, TDeps>
} {
  return {
    transformers: buildExpressionFunctions(factories, FunctionType.TRANSFORMER) as TransformerFunctions<TShapes>,
    implementations: extractFactories(factories) as unknown as FunctionImplementations<TShapes, TDeps>,
  }
}
