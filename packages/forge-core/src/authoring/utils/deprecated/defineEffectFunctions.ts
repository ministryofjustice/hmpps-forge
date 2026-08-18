import { FunctionType } from '../../types/enums'
import { ForgeDeprecations } from '../../../shared/ForgeDeprecations'
import { buildExpressionFunctions, tagFunctionType } from './defineFunction'
import type {
  EffectFunctionGroup,
  EffectFunctions,
  EffectImplementations,
  FunctionImplementations,
  FunctionShapeMap,
  ImplementationShapes,
  NoDeps,
} from './defineFunction.type'

/**
 * Creates effect functions with dependency injection from factory functions.
 *
 * This separates builder creation from registry creation:
 * - `effects`: Available immediately for use in form definitions (no deps needed)
 * - `implementations`: Passed to `createFunctionsRegistry` at runtime with real dependencies
 *
 * Each effect factory receives dependencies and returns an evaluator function.
 * The evaluator's first parameter (`context: EffectFunctionContext`) is injected
 * by the engine at runtime - the returned `effects` builders only expose the
 * remaining configuration arguments.
 *
 * @deprecated Use EffectRegistry instead.
 *
 * @param factories - Effect factories keyed by function name
 *
 * @returns Object containing effect builders and implementations
 *
 * @example
 * const { effects, implementations } = defineEffectFunctions<
 *   { LogAction: (context: EffectFunctionContext, action: string) => void },
 *   { logger: Logger }
 * >({
 *   LogAction: (deps) => (context, action) => deps.logger.info(action),
 * })
 *
 * // Use in form definitions
 * effects.LogAction('SUBMIT')  // { type: 'effect', name: 'LogAction', arguments: ['SUBMIT'] }
 *
 * // Create registry at runtime
 * const registry = createFunctionsRegistry(implementations, { logger })
 */
export function defineEffectFunctions<TShapes extends FunctionShapeMap, TDeps = NoDeps>(
  factories: FunctionImplementations<TShapes, TDeps>,
): {
  effects: EffectFunctions<TShapes>
  implementations: FunctionImplementations<TShapes, TDeps>
}
export function defineEffectFunctions<TEffects extends EffectFunctionGroup<TEffects>, TDeps = NoDeps>(
  factories: EffectImplementations<TEffects, TDeps>,
): {
  effects: TEffects
  implementations: FunctionImplementations<ImplementationShapes<'effect', TEffects>, TDeps>
}
export function defineEffectFunctions<TShapes extends FunctionShapeMap, TDeps = NoDeps>(
  factories: Record<string, unknown>,
): {
  effects: EffectFunctions<TShapes>
  implementations: FunctionImplementations<TShapes, TDeps>
} {
  ForgeDeprecations.warn(
    'FORGE_DEP_defineEffectFunctions',
    'defineEffectFunctions is deprecated - use EffectRegistry instead.',
  )

  return {
    effects: buildExpressionFunctions(factories, FunctionType.EFFECT) as EffectFunctions<TShapes>,
    implementations: tagFunctionType(factories, FunctionType.EFFECT) as unknown as FunctionImplementations<
      TShapes,
      TDeps
    >,
  }
}
