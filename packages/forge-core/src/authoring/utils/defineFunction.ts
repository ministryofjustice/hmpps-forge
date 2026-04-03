import { FunctionType } from '../types/enums'
import type { FunctionImplementations, FunctionShapeMap } from './defineFunction.type'

/**
 * Builds expression-creating functions from a set of factory implementations.
 *
 * Each returned function creates a serialisable expression object `{ type, name, arguments }`
 * that the engine evaluates at runtime. The factories themselves are not called here — only
 * their keys are used to generate the corresponding builder functions.
 *
 * This is the shared implementation behind `defineConditionFunctions`,
 * `defineTransformerFunctions`, and `defineEffectFunctions`.
 */
export function buildExpressionFunctions<TShapes extends FunctionShapeMap, TDeps>(
  factories: FunctionImplementations<TShapes, TDeps>,
  functionType: FunctionType,
) {
  const functions = {} as Record<string, (...args: unknown[]) => unknown>

  Object.keys(factories).forEach(name => {
    functions[name] = (...args: unknown[]) => ({ type: functionType, name, arguments: args })
  })

  return functions
}
