import { FunctionType } from '../../types/enums'
import { ForgeDeprecations } from '../../../shared/ForgeDeprecations'
import { buildExpressionFunctions, tagFunctionType } from './defineFunction'
import type {
  ConditionFunctionGroup,
  ConditionFunctions,
  ConditionImplementations,
  FunctionImplementations,
  FunctionShapeMap,
  ImplementationShapes,
  NoDeps,
} from './defineFunction.type'

/**
 * Creates condition functions with dependency injection from factory functions.
 *
 * This separates builder creation from registry creation:
 * - `conditions`: Available immediately for use in form definitions (no deps needed)
 * - `implementations`: Passed to `createFunctionsRegistry` at runtime with real dependencies
 *
 * Each condition factory receives dependencies and returns an evaluator function.
 * The evaluator's first parameter (`value`) is injected by the engine at runtime -
 * the returned `conditions` builders only expose the remaining configuration arguments.
 *
 * @deprecated Use ConditionRegistry instead.
 *
 * @param factories - Condition factories keyed by function name
 *
 * @returns Object containing condition builders and implementations
 *
 * @example
 * const { conditions, implementations } = defineConditionFunctions({
 *   IsPositive: () => (value: unknown) => Number(value) > 0,
 *   GreaterThan: () => (value: unknown, threshold: number) => Number(value) > threshold,
 * })
 *
 * // Use in form definitions (no deps needed)
 * conditions.GreaterThan(10)  // { type: 'condition', name: 'GreaterThan', arguments: [10] }
 *
 * // Create registry at runtime
 * const registry = createFunctionsRegistry(implementations)
 */
export function defineConditionFunctions<TShapes extends FunctionShapeMap, TDeps = NoDeps>(
  factories: FunctionImplementations<TShapes, TDeps>,
): {
  conditions: ConditionFunctions<TShapes>
  implementations: FunctionImplementations<TShapes, TDeps>
}
export function defineConditionFunctions<TConditions extends ConditionFunctionGroup<TConditions>, TDeps = NoDeps>(
  factories: ConditionImplementations<TConditions, TDeps>,
): {
  conditions: TConditions
  implementations: FunctionImplementations<ImplementationShapes<'condition', TConditions>, TDeps>
}
export function defineConditionFunctions<TShapes extends FunctionShapeMap, TDeps = NoDeps>(
  factories: Record<string, unknown>,
): {
  conditions: ConditionFunctions<TShapes>
  implementations: FunctionImplementations<TShapes, TDeps>
} {
  ForgeDeprecations.warn(
    'FORGE_DEP_defineConditionFunctions',
    'defineConditionFunctions is deprecated - use ConditionRegistry instead.',
  )

  return {
    conditions: buildExpressionFunctions(factories, FunctionType.CONDITION) as ConditionFunctions<TShapes>,
    implementations: tagFunctionType(factories, FunctionType.CONDITION) as unknown as FunctionImplementations<
      TShapes,
      TDeps
    >,
  }
}
