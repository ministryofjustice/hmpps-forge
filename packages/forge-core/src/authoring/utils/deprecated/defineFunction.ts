import { FunctionType } from '../../types/enums'
import { captureCallsite, stampCallsite } from '../../builders/utils/captureCallsite'
import type { FunctionImplementations, FunctionShapeMap } from './defineFunction.type'

/**
 * Extract the optional `prepare` hook from a factory entry. Returns
 * `undefined` for plain-function factories (back-compat).
 *
 * @deprecated Internal utility — no longer needed with registry pattern.
 */
export function extractPrepare(entry: unknown): ((...args: unknown[]) => unknown[]) | undefined {
  if (typeof entry === 'function') {
    return undefined
  }

  return (entry as { prepare?: (...args: unknown[]) => unknown[] }).prepare
}

/**
 * Normalises every factory entry to the object form, stamped with the function
 * kind. Authors never set `functionType` themselves — `defineConditionFunctions`,
 * `defineTransformerFunctions`, `defineEffectFunctions`, and `defineGeneratorFunctions`
 * each stamp their own kind here before handing `implementations` off to
 * `createFunctionsRegistry`, so the registry entry can tell the engine how to
 * enforce `inputSchema`/`argumentsSchema` without depending on call-site diagnostics.
 *
 * @deprecated Internal utility — no longer needed with registry pattern.
 */
export function tagFunctionType(
  factories: Record<string, unknown>,
  functionType: FunctionType,
): Record<string, unknown> {
  const tagged: Record<string, unknown> = {}

  Object.keys(factories).forEach(name => {
    const entry = factories[name]

    if (typeof entry === 'function') {
      const fn = entry as ((...args: unknown[]) => unknown) & { functionType?: FunctionType }
      fn.functionType = functionType
      tagged[name] = fn

      return
    }

    tagged[name] = { ...(entry as Record<string, unknown>), functionType }
  })

  return tagged
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
 *
 * @deprecated Internal utility — no longer needed with registry pattern.
 */
export function buildExpressionFunctions<TShapes extends FunctionShapeMap, TDeps>(
  factories: FunctionImplementations<TShapes, TDeps> | Record<string, unknown>,
  functionType: FunctionType,
) {
  const functions = {} as Record<string, (...args: unknown[]) => unknown>

  Object.keys(factories).forEach(name => {
    const prepare = extractPrepare((factories as Record<string, unknown>)[name])
    const expressionHandle = (...args: unknown[]) => {
      const prepared = prepare ? prepare(...args) : args
      const expr = { type: functionType, name, arguments: prepared }

      stampCallsite(expr, captureCallsite(expressionHandle))

      return expr
    }

    functions[name] = expressionHandle
  })

  return functions
}
