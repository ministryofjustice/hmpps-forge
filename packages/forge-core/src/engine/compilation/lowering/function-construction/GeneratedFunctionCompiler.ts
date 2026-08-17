import ExpressionDispatcher from '../expressions/ExpressionDispatcher'
import CodeEmitter from '../../codegen/CodeEmitter'
import { CodeNode, CodeNodeKind } from '../../codegen/codeNode.type'
import SourceRenderer, { MarkerSegment } from '../../codegen/SourceRenderer'
import { encodeInlineSourceMap } from '../../codegen/sourceMapEncoder'
import { createCompiledFunction, GeneratedFunction, measureWrapperOffset } from './compiledFunctionFactory'
import { generatedFunctionHelpers } from './GeneratedFunctionHelpers'
import ForgeCompilationError from '../../../errors/ForgeCompilationError'
import ForgeRuntimeEvaluationError from '../../../errors/ForgeRuntimeEvaluationError'

interface CompileOptions {
  forceAsync?: boolean
  phase?: string
  /** Journey/step identity segment for the script URL, e.g. `guide.defining-steps` */
  label?: string
}

interface RuntimeDiagnosticState {
  readonly nodeId?: string
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
    formattedPath?: string,
    functionName?: string,
    functionType?: string,
    definedAt?: string,
  ) => unknown
}

interface ScriptLabelSource {
  readonly diagnostics?: {
    readonly source: { readonly formattedPath: string }
  }
}

interface GeneratedBody {
  readonly strictDirective: string | undefined
  readonly bodyNodes: CodeNode[]
}

const RUNTIME_DIAGNOSTICS_PARAM = '_forgeRuntimeDiagnostics'
export const GENERATED_FUNCTION_HELPERS_PARAM = '_forgeHelpers'

/**
 * Resets the expression dispatcher before a compiler builds source.
 *
 * The dispatcher owns request-shape state such as iterator scope frames and
 * async discovery. Keeping this reset path shared makes every compiler use the
 * same hybrid sync/async rules while still letting each compiler own its source
 * layout.
 */
export function buildGeneratedSource<TSource>(expr: ExpressionDispatcher, buildSource: () => TSource): TSource {
  expr.reset()

  return buildSource()
}

/**
 * Compiles a generated-source node tree into either Function or AsyncFunction.
 *
 * Most compilers decide async from expression calls discovered by the
 * dispatcher. Hook lifecycles force async because effects are always awaited
 * and their side effects must complete before outcomes are inspected.
 */
export function compileGeneratedFunction<TFunction extends GeneratedFunction>(
  expr: ExpressionDispatcher,
  parameterNames: string[],
  buildSource: () => string | CodeEmitter,
  options: CompileOptions = {},
): TFunction {
  const phase = options.phase ?? 'unknown'
  const tracer = expr.tracer

  return tracer.span(
    `codegen:${phase}`,
    'codegen.function',
    span => {
      const wrapperNodes = wrapGeneratedBody(buildGeneratedSource(expr, buildSource))
      const usesAwait = options.forceAsync === true || expr.usesAwait
      const { source, segmentsByLine } = new SourceRenderer().render(wrapperNodes)
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
          {
            usesAwait,
            sourceName: nextSourceName(phase, options.label),
            sourceMapUrl: resolveSourceMapUrl(segmentsByLine, usesAwait),
          },
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

/**
 * Every compiled function gets its own script URL. Debuggers key scripts by
 * URL, so N steps sharing `forge:compiled/hooks` would shadow each other in
 * scripts panels even though V8 itself keeps them distinct. The prefix stays
 * `forge:compiled/` so frame filtering still treats these as internal.
 *
 * A label makes the scripts panel navigable (`forge:compiled/resolve/dump.form`
 * instead of `forge:compiled/resolve/3`); the counter guarantees uniqueness
 * when the same label compiles again or no label is available.
 */
const sourceNameCounters = new Map<string, number>()

const nextSourceName = (phase: string, label: string | undefined): string => {
  const counterKey = label === undefined ? phase : `${phase}/${label}`
  const next = (sourceNameCounters.get(counterKey) ?? 0) + 1

  sourceNameCounters.set(counterKey, next)

  if (label === undefined) {
    return `forge:compiled/${phase}/${next}`
  }

  return next === 1 ? `forge:compiled/${phase}/${label}` : `forge:compiled/${phase}/${label}/${next}`
}

/**
 * Derives the script-URL identity segment from the first node carrying a
 * formatted path: the leading journey/step segments of
 * `"dump > form > blocks[1] (govukInsetText) > hidden"` become `dump.form`.
 * Structural segments (indexed wiring like `onAccess[0]`, parenthesised kinds)
 * end the walk — they describe a position inside the step, not its identity.
 */
export const deriveScriptLabel = (
  nodes: readonly (ScriptLabelSource | undefined)[],
  options: { maxDepth?: number } = {},
): string | undefined => {
  const formattedPath = nodes.find(node => node?.diagnostics !== undefined)?.diagnostics?.source.formattedPath

  if (formattedPath === undefined) {
    return undefined
  }

  const identitySegments: string[] = []

  formattedPath
    .split(' > ')
    .slice(0, options.maxDepth ?? 2)
    .some(segment => {
      if (segment.includes('[') || segment.includes('(')) {
        return true
      }

      identitySegments.push(segment.replace(/[^\w.-]+/g, '-'))

      return false
    })

  return identitySegments.length > 0 ? identitySegments.join('.') : undefined
}

const createRuntimeDiagnostics = (phase: string): RuntimeEvaluationDiagnostics => {
  const diagnostics: RuntimeEvaluationDiagnostics = {
    current: undefined,
    wrap: (error, nodeId, formattedPath, functionName, functionType, definedAt) => {
      if (error instanceof ForgeRuntimeEvaluationError) {
        return error
      }

      const current = diagnostics.current

      return new ForgeRuntimeEvaluationError({
        phase,
        nodeId: nodeId ?? current?.nodeId,
        formattedPath: formattedPath ?? current?.formattedPath,
        functionName: functionName ?? current?.functionName,
        functionType: functionType ?? current?.functionType,
        definedAt: definedAt ?? current?.definedAt,
        cause: error,
      })
    },
  }

  return diagnostics
}

/**
 * Hoists any `"use strict"` directive above the wrapper, then folds the body
 * into a try/catch that routes escaping errors through the runtime
 * diagnostics so author-facing stacks carry node identity.
 */
const wrapGeneratedBody = (built: string | CodeEmitter): CodeNode[] => {
  const { strictDirective, bodyNodes } = splitStrictDirective(built)

  return [
    ...(strictDirective === undefined ? [] : [lineNode(strictDirective)]),
    { kind: CodeNodeKind.COMMENT, text: '// Compiled by Forge from the journey definition.' },
    {
      kind: CodeNodeKind.TRY_CATCH,
      tryBody: bodyNodes,
      errorName: 'error',
      catchBody: [lineNode(`throw ${RUNTIME_DIAGNOSTICS_PARAM}.wrap(error);`)],
    },
  ]
}

const splitStrictDirective = (built: string | CodeEmitter): GeneratedBody => {
  if (typeof built === 'string') {
    const strictDirective = getStrictDirective(built)
    const body = strictDirective === undefined ? built : built.slice(strictDirective.length).trimStart()

    return { strictDirective, bodyNodes: toBodyNodes(body) }
  }

  const nodes = [...built.toNodes()]
  const [first] = nodes

  if (first !== undefined && first.kind === CodeNodeKind.LINE && getStrictDirective(first.text) === first.text) {
    return { strictDirective: first.text, bodyNodes: nodes.slice(1) }
  }

  return { strictDirective: undefined, bodyNodes: nodes }
}

const toBodyNodes = (body: string): CodeNode[] =>
  body
    .split('\n')
    .map((line): CodeNode => (line.length === 0 ? { kind: CodeNodeKind.BLANK_LINE } : lineNode(line)))

const lineNode = (text: string): CodeNode => ({ kind: CodeNodeKind.LINE, text })

const getStrictDirective = (source: string): string | undefined => {
  if (source.startsWith('"use strict";')) {
    return '"use strict";'
  }

  if (source.startsWith("'use strict';")) {
    return "'use strict';"
  }

  return undefined
}

const resolveSourceMapUrl = (
  segmentsByLine: readonly (readonly MarkerSegment[])[],
  usesAwait: boolean,
): string | undefined => {
  const wrapperOffset = measureWrapperOffset(usesAwait)

  if (wrapperOffset === undefined || segmentsByLine.every(segments => segments.length === 0)) {
    return undefined
  }

  return encodeInlineSourceMap(segmentsByLine, wrapperOffset)
}

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => {
  return value !== null &&
    value !== undefined &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
}
