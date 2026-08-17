import { createHash } from 'node:crypto'
import ExpressionDispatcher from '../expressions/ExpressionDispatcher'
import BlankLineCodeNode from '../../codegen/BlankLineCodeNode'
import { code } from '../../codegen/Code'
import CodeGenerator from '../../codegen/CodeGenerator'
import CommentCodeNode from '../../codegen/CommentCodeNode'
import DirectiveCodeNode from '../../codegen/DirectiveCodeNode'
import GeneratedCodeNode from '../../codegen/GeneratedCodeNode'
import Name from '../../codegen/Name'
import ThrowCodeNode from '../../codegen/ThrowCodeNode'
import TryCatchCodeNode from '../../codegen/TryCatchCodeNode'
import SourceRenderer, { SourceMapSegment } from '../../codegen/SourceRenderer'
import { encodeInlineSourceMap } from '../../codegen/sourceMapEncoder'
import { createCompiledFunction, GeneratedFunction, measureWrapperOffset } from './compiledFunctionFactory'
import { generatedFunctionHelpers } from './GeneratedFunctionHelpers'
import ForgeCompilationError from '../../../errors/ForgeCompilationError'
import ForgeRuntimeEvaluationError from '../../../errors/ForgeRuntimeEvaluationError'
import type { DiagnosticMetadata } from '../emitters/DiagnosticEmitter'

/**
 * The eight generated-function phases. Typing `PHASE_PURPOSES` by this enum
 * makes a missing purpose entry a type error, so the header comments can never
 * drift from the phases the compilers actually emit.
 */
export enum CompilationPhase {
  ANSWER_PREPARATION = 'answer-preparation',
  VALIDATION = 'validation',
  ENTRY_VALIDATION = 'entry-validation',
  HOOKS = 'hooks',
  REACHABILITY = 'reachability',
  FIELD_INVENTORY = 'field-inventory',
  RESOLVE = 'resolve',
  ROUTE_TREE = 'route-tree',
}

interface CompileOptions {
  forceAsync?: boolean
  phase?: CompilationPhase
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
  resolve(reference: number): RuntimeDiagnosticState | undefined
  wrap(error: unknown, reference?: number): unknown
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

/** Renders inspectable source without constructing the generated function. */
export function renderGeneratedSource(expr: ExpressionDispatcher, buildSource: () => CodeGenerator): string {
  const built = buildGeneratedSource(expr, buildSource)

  return new SourceRenderer().render(built.toNodes()).source
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
  buildSource: () => CodeGenerator,
  options: CompileOptions = {},
): TFunction {
  const phase = options.phase ?? 'unknown'
  const tracer = expr.tracer

  return tracer.span(
    `codegen:${phase}`,
    'codegen.function',
    span => {
      const generatedSource = buildGeneratedSource(expr, buildSource)
      const diagnosticCatalogue = expr.diagnosticCatalogue
      const wrapperNodes = wrapGeneratedBody(generatedSource, phase)
      const usesAwait = options.forceAsync === true || expr.usesAwait
      const { source, segmentsByLine } = new SourceRenderer().render(wrapperNodes)
      const sourceMapUrl = resolveSourceMapUrl(segmentsByLine, usesAwait)
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
            sourceName: nextSourceName(phase, options.label, source, sourceMapUrl),
            sourceMapUrl,
          },
        )
      } catch (cause) {
        throw new ForgeCompilationError({ phase, cause })
      }

      const wrapped: GeneratedFunction = (...args: never[]) => {
        const runtimeDiagnostics = createRuntimeDiagnostics(phase, diagnosticCatalogue)
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
 * A label makes the scripts panel navigable, while a content fingerprint stops
 * an IDE reusing stale generated source after reconnecting to a restarted
 * process. Every script remains a sibling `.js` file so debuggers do not have
 * to represent one generated URL as both a file and a directory.
 */
const sourceNameCounters = new Map<string, number>()

const nextSourceName = (
  phase: string,
  label: string | undefined,
  source: string,
  sourceMapUrl: string | undefined,
): string => {
  const fingerprint = createHash('sha256')
    .update(source)
    .update('\0')
    .update(sourceMapUrl ?? '')
    .digest('hex')
    .slice(0, 8)
  const readableName = label ?? 'unlabelled'
  const counterKey = `${phase}/${readableName}`
  const next = (sourceNameCounters.get(counterKey) ?? 0) + 1

  sourceNameCounters.set(counterKey, next)

  return `forge:compiled/${phase}/${readableName}.${fingerprint}.${next}.js`
}

const createRuntimeDiagnostics = (
  phase: string,
  diagnosticCatalogue: readonly DiagnosticMetadata[],
): RuntimeEvaluationDiagnostics => {
  const diagnostics: RuntimeEvaluationDiagnostics = {
    current: undefined,
    resolve: reference => diagnosticCatalogue[reference],
    wrap: (error, reference) => {
      if (error instanceof ForgeRuntimeEvaluationError) {
        return error
      }

      const current =
        reference === undefined ? diagnostics.current : (diagnostics.resolve(reference) ?? diagnostics.current)

      return new ForgeRuntimeEvaluationError({
        phase,
        nodeId: current?.nodeId,
        formattedPath: current?.formattedPath,
        functionName: current?.functionName,
        functionType: current?.functionType,
        definedAt: current?.definedAt,
        cause: error,
      })
    },
  }

  return diagnostics
}

/**
 * Explains each compiled function to the developer reading it in a debugger:
 * what it does, when it runs, and what it returns. Rendered as the header
 * comment block ahead of the generated body.
 */
const PHASE_PURPOSES: Record<CompilationPhase, readonly string[]> = {
  [CompilationPhase.ANSWER_PREPARATION]: [
    "Prepares this step's field answers before validation: POST requests normalise",
    'the submitted values, GET requests surface stored answers and defaults.',
    'Returns one preparation task per field for the work executor to run.',
  ],
  [CompilationPhase.VALIDATION]: [
    "Builds this step's validation plan: one entry per field rule plus any",
    'domain-level checks. The work executor runs it and stores the outcome',
    'that decides error display.',
  ],
  [CompilationPhase.ENTRY_VALIDATION]: [
    "Evaluates this step's entry conditions; a failing condition redirects",
    'away before the step renders.',
  ],
  [CompilationPhase.HOOKS]: [
    'Runs the authored hook lifecycle: each hook evaluates its condition, then',
    'its effects, in authored order. Effects are awaited before any outcome',
    'is inspected.',
  ],
  [CompilationPhase.REACHABILITY]: [
    'Computes reachability facts for the journey: which steps can currently be',
    'entered and where forward redirects should land.',
  ],
  [CompilationPhase.FIELD_INVENTORY]: [
    'Lists every field each step owns, so answers belonging to steps that',
    'become unreachable can be cleared down.',
  ],
  [CompilationPhase.RESOLVE]: [
    "Resolves this step's blocks into render-ready props, evaluating conditions",
    'and dynamic values against the current request context.',
  ],
  [CompilationPhase.ROUTE_TREE]: ['Resolves the metadata carried on each route-tree node for the current request.'],
}

const resolvePhasePurpose = (phase: string): readonly string[] => {
  return (PHASE_PURPOSES as Record<string, readonly string[] | undefined>)[phase] ?? []
}

/**
 * Hoists any `"use strict"` directive above the wrapper, then folds the body
 * into a try/catch that routes escaping errors through the runtime
 * diagnostics so author-facing stacks carry node identity.
 */
const wrapGeneratedBody = (generator: CodeGenerator, phase: string): GeneratedCodeNode[] => {
  const bodyNodes = [...generator.toNodes()]
  const firstNode = bodyNodes[0]
  const strictDirective =
    firstNode instanceof DirectiveCodeNode && firstNode.value === 'use strict' ? firstNode : undefined

  if (strictDirective !== undefined) {
    bodyNodes.shift()
  }

  while (bodyNodes[0] instanceof BlankLineCodeNode) {
    bodyNodes.shift()
  }

  const errorName = new Name('error')

  return [
    ...(strictDirective === undefined ? [] : [strictDirective]),
    new CommentCodeNode('Compiled by Forge from the journey definition.', false),
    ...resolvePhasePurpose(phase).map(purposeLine => new CommentCodeNode(purposeLine, false)),
    new TryCatchCodeNode(bodyNodes, errorName, [
      new ThrowCodeNode(code`${new Name(RUNTIME_DIAGNOSTICS_PARAM)}.wrap(${errorName})`),
    ]),
  ]
}

const resolveSourceMapUrl = (
  segmentsByLine: readonly (readonly SourceMapSegment[])[],
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
