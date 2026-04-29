import FunctionRegistry from '../../registries/FunctionRegistry'
import NodeCompilationDispatcher from './NodeCompilationDispatcher'
import { createCompiledFunction, GeneratedFunction } from './compiledFunctionFactory'
import ForgeCompilationError from '../../errors/ForgeCompilationError'
import ForgeRuntimeEvaluationError from '../../errors/ForgeRuntimeEvaluationError'
import type { DSLPathSegment } from '../../diagnostics/sourceMetadata'

interface CompileOptions {
  forceAsync?: boolean
  phase?: string
}

interface RuntimeDiagnosticState {
  readonly nodeId?: string
  readonly path?: readonly DSLPathSegment[]
  readonly formattedPath?: string
  readonly functionName?: string
  readonly functionType?: string
}

interface RuntimeEvaluationDiagnostics {
  current: RuntimeDiagnosticState | undefined
  wrap: (
    error: unknown,
    nodeId?: string,
    path?: readonly DSLPathSegment[],
    formattedPath?: string,
    functionName?: string,
    functionType?: string,
  ) => ForgeRuntimeEvaluationError
}

const RUNTIME_DIAGNOSTICS_PARAM = '_forgeRuntimeDiagnostics'

/**
 * Resets the expression dispatcher before a compiler builds source.
 *
 * The dispatcher owns request-shape state such as iterator scope frames and
 * async discovery. Keeping this reset path shared makes every compiler use the
 * same hybrid sync/async rules while still letting each compiler own its source
 * layout.
 */
export function buildGeneratedSource(
  expr: NodeCompilationDispatcher,
  functionRegistry: FunctionRegistry | undefined,
  buildSource: () => string,
): string {
  expr.setFunctionRegistry(functionRegistry)
  expr.reset()

  return buildSource()
}

/**
 * Compiles generated source into either Function or AsyncFunction.
 *
 * Most compilers decide async from expression calls discovered by the
 * dispatcher. Hook lifecycles force async because effects are always awaited
 * and their side effects must complete before outcomes are inspected.
 */
export function compileGeneratedFunction<TFunction extends GeneratedFunction>(
  expr: NodeCompilationDispatcher,
  parameterNames: string[],
  functionRegistry: FunctionRegistry | undefined,
  buildSource: () => string,
  options: CompileOptions = {},
): TFunction {
  const phase = options.phase ?? 'unknown'
  const source = wrapGeneratedSource(buildGeneratedSource(expr, functionRegistry, buildSource))
  const usesAwait = options.forceAsync === true || expr.usesAwait
  let compiled: GeneratedFunction

  try {
    compiled = createCompiledFunction<GeneratedFunction>(
      [...parameterNames, RUNTIME_DIAGNOSTICS_PARAM],
      source,
      usesAwait,
    )
  } catch (cause) {
    throw new ForgeCompilationError({ phase, cause })
  }

  const wrapped: GeneratedFunction = (...args: never[]) => {
    const runtimeDiagnostics = createRuntimeDiagnostics(phase)
    const runtimeArgs = parameterNames.map((_, index) => args[index])

    try {
      const result = Reflect.apply(compiled, undefined, [...runtimeArgs, runtimeDiagnostics])

      if (isPromiseLike(result)) {
        return Promise.resolve(result).catch((error: unknown) => {
          throw runtimeDiagnostics.wrap(error)
        })
      }

      return result
    } catch (error) {
      throw runtimeDiagnostics.wrap(error)
    }
  }

  return wrapped as TFunction
}

const createRuntimeDiagnostics = (phase: string): RuntimeEvaluationDiagnostics => {
  const diagnostics: RuntimeEvaluationDiagnostics = {
    current: undefined,
    wrap: (error, nodeId, path, formattedPath, functionName, functionType) => {
      if (error instanceof ForgeRuntimeEvaluationError) {
        return error
      }

      const current = diagnostics.current

      return new ForgeRuntimeEvaluationError({
        phase,
        cause: error,
        nodeId: nodeId ?? current?.nodeId,
        path: path ?? current?.path,
        formattedPath: formattedPath ?? current?.formattedPath,
        functionName: functionName ?? current?.functionName,
        functionType: functionType ?? current?.functionType,
      })
    },
  }

  return diagnostics
}

const wrapGeneratedSource = (source: string): string => {
  const strictDirective = getStrictDirective(source)
  const body = strictDirective === undefined ? source : source.slice(strictDirective.length).trimStart()
  const prefix = strictDirective === undefined ? '' : `${strictDirective}\n`

  return `${prefix}var _forgeNodeId;\nvar _forgeDslPath;\nvar _forgeFormattedPath;\nvar _forgeFunctionName;\nvar _forgeFunctionType;\ntry {\n${body}\n} catch(e) {\nthrow ${RUNTIME_DIAGNOSTICS_PARAM}.wrap(e, _forgeNodeId, _forgeDslPath, _forgeFormattedPath, _forgeFunctionName, _forgeFunctionType);\n}`
}

const getStrictDirective = (source: string): string | undefined => {
  if (source.startsWith('"use strict";')) {
    return '"use strict";'
  }

  if (source.startsWith("'use strict';")) {
    return "'use strict';"
  }

  return undefined
}

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => {
  return value !== null &&
    value !== undefined &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
}
