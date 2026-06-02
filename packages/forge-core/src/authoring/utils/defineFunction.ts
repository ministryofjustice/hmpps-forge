import { FunctionType } from '../types/enums'
import type { FunctionImplementations, FunctionShapeMap } from './defineFunction.type'

/**
 * Extract the plain factory function from a factory entry — either the entry
 * itself (back-compat shape) or its `.factory` property (union shape).
 */
function extractFactory(entry: unknown): (deps: unknown) => unknown {
  if (typeof entry === 'function') {
    return entry as (deps: unknown) => unknown
  }

  return (entry as { factory: (deps: unknown) => unknown }).factory
}

/**
 * Extract the optional `prepare` hook from a factory entry. Returns
 * `undefined` for plain-function factories (back-compat).
 */
export function extractPrepare(entry: unknown): ((...args: unknown[]) => unknown[]) | undefined {
  if (typeof entry === 'function') {
    return undefined
  }

  return (entry as { prepare?: (...args: unknown[]) => unknown[] }).prepare
}

/**
 * Normalise a map of factory entries to a plain map of factory functions, for
 * handing to `createFunctionsRegistry`. Entries that use the `{ validate, factory }`
 * object form are reduced to just their `factory`; plain-function entries are
 * passed through.
 */
export function extractFactories<TMap extends Record<string, unknown>>(
  factories: TMap,
): { [K in keyof TMap]: (deps: unknown) => unknown } {
  const out = {} as { [K in keyof TMap]: (deps: unknown) => unknown }

  Object.keys(factories).forEach(name => {
    const key = name as keyof TMap
    out[key] = extractFactory(factories[key])
  })

  return out
}

/**
 * Builds expression-creating functions from a set of factory implementations.
 *
 * Each returned function creates a serialisable expression object `{ type, name, arguments }`
 * that the engine evaluates at runtime. The factories themselves are not called here - only
 * their keys are used to generate the corresponding builder functions.
 *
 * If a factory entry provides a `prepare` hook, it runs synchronously when the
 * builder is invoked. The hook can sanitise or reshape arguments before they
 * enter the expression, and/or throw to reject invalid arguments.
 *
 * This is the shared implementation behind `defineConditionFunctions`,
 * `defineTransformerFunctions`, and `defineEffectFunctions`.
 */
export function buildExpressionFunctions<TShapes extends FunctionShapeMap, TDeps>(
  factories: FunctionImplementations<TShapes, TDeps> | Record<string, unknown>,
  functionType: FunctionType,
) {
  const functions = {} as Record<string, (...args: unknown[]) => unknown>

  Object.keys(factories).forEach(name => {
    const prepare = extractPrepare((factories as Record<string, unknown>)[name])
    functions[name] = (...args: unknown[]) => {
      const prepared = prepare ? prepare(...args) : args

      return { type: functionType, name, arguments: prepared }
    }
  })

  return functions
}
