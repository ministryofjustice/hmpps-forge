import { FunctionEvaluator, FunctionRegistryObject } from '../../types/functions.type'
import type { FunctionType } from '../../types/enums'
import type { FunctionImplementations, FunctionShapeMap, NoDeps } from './defineFunction.type'

/**
 * Detect if a function is async by checking its constructor.
 *
 * Returns true for async function declarations, async arrow functions,
 * and async methods. Returns false for regular functions that return
 * Promises (requires the async keyword).
 */
function isAsyncFunction(fn: FunctionEvaluator<unknown>): boolean {
  return fn.constructor.name === 'AsyncFunction'
}

function extractFactory(entry: unknown): (deps: unknown) => unknown {
  if (typeof entry === 'function') {
    return entry as (deps: unknown) => unknown
  }

  return (entry as { factory: (deps: unknown) => unknown }).factory
}

function extractFunctionType(entry: unknown): FunctionType | undefined {
  return (entry as { functionType?: FunctionType }).functionType
}

/**
 * Resolves function factory entries into a registry of ready-to-call evaluators.
 *
 * Each entry can be a plain factory function (back-compat) or an object with
 * `{ factory, functionType?, prepare? }`. The registry decomposes each entry,
 * calls the factory with `deps` to produce an evaluator, and preserves metadata
 * like `functionType` and `isAsync` for the engine to use at runtime.
 *
 * @param implementations - Object mapping function names to factory entries
 * @param deps - Dependencies to inject into each factory (omit if none needed)
 *
 * @returns A registry object mapping function names to `{ name, evaluate, isAsync, functionType? }`
 */
export function createFunctionsRegistry<TShapes extends FunctionShapeMap>(
  implementations: FunctionImplementations<TShapes, NoDeps>,
): FunctionRegistryObject
export function createFunctionsRegistry<TShapes extends FunctionShapeMap, TDeps>(
  implementations: FunctionImplementations<TShapes, TDeps>,
  deps: TDeps,
): FunctionRegistryObject
export function createFunctionsRegistry<TShapes extends FunctionShapeMap, TDeps>(
  implementations: FunctionImplementations<TShapes, TDeps>,
  deps?: TDeps,
): FunctionRegistryObject {
  const resolvedDeps = (deps ?? {}) as TDeps
  const registry = {} as FunctionRegistryObject

  Object.keys(implementations).forEach(name => {
    const entry = (implementations as Record<string, unknown>)[name]
    const factory = extractFactory(entry)
    const evaluate = factory(resolvedDeps) as FunctionEvaluator
    const functionType = extractFunctionType(entry)

    registry[name] = {
      name,
      evaluate,
      isAsync: isAsyncFunction(evaluate),
      functionType,
    }
  })

  return registry
}
