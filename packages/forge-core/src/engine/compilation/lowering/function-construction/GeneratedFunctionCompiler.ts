import ExpressionDispatcher from '../expressions/ExpressionDispatcher'
import { createCompiledFunction, GeneratedFunction } from './compiledFunctionFactory'
import { generatedFunctionHelpers } from './GeneratedFunctionHelpers'
import ForgeCompilationError from '../../../errors/ForgeCompilationError'
import ForgeRuntimeEvaluationError, {
  decorateForgeRuntimeEvaluationError,
  type ForgeRuntimeEvaluationDiagnostics,
} from '../../../errors/ForgeRuntimeEvaluationError'
import type { DSLPathSegment } from '../../../../shared/diagnostics/sourceLocation.type'

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
  readonly definedAt?: string
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
    definedAt?: string,
  ) => unknown
}

export const RUNTIME_DIAGNOSTICS_PARAM = '_forgeRuntimeDiagnostics'
export const GENERATED_FUNCTION_HELPERS_PARAM = '_forgeHelpers'

/**
 * Resets the expression dispatcher before a compiler builds source.
 *
 * The dispatcher owns request-shape state such as iterator scope frames and
 * async discovery. Keeping this reset path shared makes every compiler use the
 * same hybrid sync/async rules while still letting each compiler own its source
 * layout.
 */
export function buildGeneratedSource(expr: ExpressionDispatcher, buildSource: () => string): string {
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
  expr: ExpressionDispatcher,
  parameterNames: string[],
  buildSource: () => string,
  options: CompileOptions = {},
): TFunction {
  const phase = options.phase ?? 'unknown'
  const tracer = expr.tracer

  return tracer.span(
    `codegen:${phase}`,
    'codegen.function',
    span => {
      const source = wrapGeneratedSource(buildGeneratedSource(expr, buildSource))
      const usesAwait = options.forceAsync === true || expr.usesAwait
      let compiled: GeneratedFunction

      // Record before compiling so a source string that fails to compile is
      // still captured on the incomplete span. recordTraceMetadataAtStart
      // replaces beginFields wholesale, so re-record phase alongside source.
      if (tracer.captureGeneratedSource) {
        span?.recordTraceMetadataAtStart({ phase, source })
      }

      try {
        compiled = createCompiledFunction<GeneratedFunction>(
          [...parameterNames, GENERATED_FUNCTION_HELPERS_PARAM, RUNTIME_DIAGNOSTICS_PARAM],
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
          const result = Reflect.apply(compiled, undefined, [
            ...runtimeArgs,
            generatedFunctionHelpers,
            runtimeDiagnostics,
          ])

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

      span?.recordTraceMetadataAtFinish({ async: usesAwait })

      return wrapped as TFunction
    },
    { phase },
  )
}

const createRuntimeDiagnostics = (phase: string): RuntimeEvaluationDiagnostics => {
  const diagnostics: RuntimeEvaluationDiagnostics = {
    current: undefined,
    wrap: (error, nodeId, path, formattedPath, functionName, functionType, definedAt) => {
      if (error instanceof ForgeRuntimeEvaluationError) {
        return error
      }

      const current = diagnostics.current
      const runtimeDiagnostics: ForgeRuntimeEvaluationDiagnostics = {
        phase,
        nodeId: nodeId ?? current?.nodeId,
        path: path ?? current?.path,
        formattedPath: formattedPath ?? current?.formattedPath,
        functionName: functionName ?? current?.functionName,
        functionType: functionType ?? current?.functionType,
        definedAt: definedAt ?? current?.definedAt,
      }

      if (error instanceof Error) {
        return decorateForgeRuntimeEvaluationError(error, runtimeDiagnostics)
      }

      return new ForgeRuntimeEvaluationError({
        ...runtimeDiagnostics,
        cause: error,
      })
    },
  }

  return diagnostics
}

const wrapGeneratedSource = (source: string): string => {
  const strictDirective = getStrictDirective(source)
  const body = strictDirective === undefined ? source : source.slice(strictDirective.length).trimStart()
  const prefix = strictDirective === undefined ? '' : `${strictDirective}\n`

  return `${prefix}var _forgeNodeId;\n
  var _forgeDslPath;\n
  var _forgeFormattedPath;\n
  var _forgeFunctionName;\n
  var _forgeFunctionType;\n
  try {
    \n
    ${body}
    \n
  } catch(e) {\n
  throw ${RUNTIME_DIAGNOSTICS_PARAM}.wrap(
    e,
    _forgeNodeId,
    _forgeDslPath,
    _forgeFormattedPath,
    _forgeFunctionName,
    _forgeFunctionType);\n
  }`
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
