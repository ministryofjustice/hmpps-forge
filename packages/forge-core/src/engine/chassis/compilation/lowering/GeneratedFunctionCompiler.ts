import { createHash } from 'node:crypto'
import ExpressionDispatcher from './expressions/ExpressionDispatcher'
import BlankLineCodeNode from './codegen/statements/BlankLineCodeNode'
import { code } from './codegen/fragments/CodeFragment'
import CodeGenerator from './codegen/CodeGenerator'
import CommentCodeNode from './codegen/statements/CommentCodeNode'
import DirectiveCodeNode from './codegen/statements/DirectiveCodeNode'
import CodeNode from './codegen/statements/CodeNode'
import IdentifierName from './codegen/fragments/IdentifierName'
import ThrowCodeNode from './codegen/statements/ThrowCodeNode'
import TryCatchCodeNode from './codegen/statements/TryCatchCodeNode'
import SourceRenderer, { SourceMapSegment } from './codegen/rendering/SourceRenderer'
import { encodeInlineSourceMap } from './codegen/rendering/sourceMapEncoder'
import { generatedFunctionRuntimeLibrary } from './generatedFunctionRuntimeLibrary'
import ForgeCompilationError from '../../../errors/ForgeCompilationError'
import ForgeRuntimeEvaluationError from '../../../errors/ForgeRuntimeEvaluationError'
import type { DiagnosticMetadata } from './emitters/DiagnosticEmitter'

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
export const GENERATED_FUNCTION_RUNTIME_LIBRARY_PARAM = '_forgeHelpers'

/**
 * Resets the expression dispatcher (the component that compiles authored
 * expressions into JavaScript) before a compiler builds source.
 *
 * The dispatcher tracks stateful context like the current iterator nesting
 * and whether the generated code needs `await`. Resetting here makes every
 * compiler start from a clean slate while still sharing the same sync/async
 * decision rules.
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
 * Compiles a generated-source node tree into either `Function` or `AsyncFunction`.
 *
 * A compiler becomes async only when the expression dispatcher finds an
 * `await` at the top level of the generated code; awaits inside nested
 * function expressions belong to those functions and do not count.
 */
export function compileGeneratedFunction<TFunction extends GeneratedFunction>(
  expr: ExpressionDispatcher,
  parameterNames: string[],
  buildSource: () => CodeGenerator,
  options: CompileOptions = {},
): TFunction {
  const phase = options.phase ?? 'unknown'
  const generatedSource = buildGeneratedSource(expr, buildSource)
  const diagnosticCatalogue = expr.diagnosticCatalogue
  const wrapperNodes = wrapGeneratedBody(generatedSource, phase)
  const usesAwait = expr.usesAwait
  const { source, segmentsByLine } = new SourceRenderer().render(wrapperNodes)
  const sourceMapUrl = resolveSourceMapUrl(segmentsByLine, usesAwait)
  let compiled: GeneratedFunction

  try {
    compiled = createCompiledFunction<GeneratedFunction>(
      [...parameterNames, GENERATED_FUNCTION_RUNTIME_LIBRARY_PARAM, RUNTIME_DIAGNOSTICS_PARAM],
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
        generatedFunctionRuntimeLibrary,
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

  return wrapped as TFunction
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
    'Selects which validation groups to display when this step first renders:',
    'each validateOnEntry rule whose condition holds contributes its groups.',
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
 * Moves any `"use strict"` directive above the wrapper, then wraps the body
 * in a try/catch. Uncaught errors are routed through the runtime diagnostics
 * so stack traces shown to journey authors include the node that failed.
 */
const wrapGeneratedBody = (generator: CodeGenerator, phase: string): CodeNode[] => {
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

  const errorName = new IdentifierName('error')

  return [
    ...(strictDirective === undefined ? [] : [strictDirective]),
    new CommentCodeNode('Compiled by Forge from the journey definition.', false),
    ...resolvePhasePurpose(phase).map(purposeLine => new CommentCodeNode(purposeLine, false)),
    new TryCatchCodeNode(bodyNodes, errorName, [
      new ThrowCodeNode(code`${new IdentifierName(RUNTIME_DIAGNOSTICS_PARAM)}.wrap(${errorName})`),
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

export type GeneratedFunction = (...args: never[]) => unknown

const AsyncFunctionConstructor = Object.getPrototypeOf(async function compiledAsync() {
  return undefined
}).constructor as FunctionConstructor

/**
 * Creates either a normal Function or an AsyncFunction from generated source.
 *
 * The compiler keeps sync functions genuinely sync for the hot path, but any
 * emitted `await` requires the async constructor because `await` is illegal in a
 * normal function body. Runtime callers still await the result so both shapes
 * share the same orchestration path.
 */
interface CreateCompiledFunctionOptions {
  usesAwait: boolean
  /** Named script origin so eval'd frames render as `forge:compiled/...` instead of `<anonymous>` */
  sourceName?: string
  /** Inline `data:` source map binding definition-file breakpoints onto the compiled function */
  sourceMapUrl?: string
}

export function createCompiledFunction<TFunction extends GeneratedFunction>(
  parameterNames: string[],
  source: string,
  options: CreateCompiledFunctionOptions,
): TFunction {
  const constructor = options.usesAwait ? AsyncFunctionConstructor : Function
  const namedSource = [
    source,
    ...(options.sourceName === undefined ? [] : [`//# sourceURL=${options.sourceName}`]),
    ...(options.sourceMapUrl === undefined ? [] : [`//# sourceMappingURL=${options.sourceMapUrl}`]),
  ].join('\n')

  return new constructor(...parameterNames, namedSource) as TFunction
}

/**
 * `new Function(body)` doesn't compile the body on its own - V8 wraps it in a
 * few lines of `function anonymous(...) {` scaffolding first. Stack traces and
 * source maps count lines from the top of that wrapped script, so our line
 * numbers are all off by the height of the scaffolding. Rather than hardcode
 * that height (it can differ between sync and async, or between engine
 * versions), we measure it: build a throwaway function with a known one-line
 * body, `toString()` it, and see which line the body actually landed on.
 */
const wrapperOffsets = new Map<boolean, number | undefined>()

export const measureWrapperOffset = (usesAwait: boolean): number | undefined => {
  if (wrapperOffsets.has(usesAwait)) {
    return wrapperOffsets.get(usesAwait)
  }

  const probeBody = 'return "forge-offset-probe";'
  const constructor = usesAwait ? AsyncFunctionConstructor : Function
  const probeLine = new constructor(probeBody)
    .toString()
    .split('\n')
    .findIndex(line => line === probeBody)
  const offset = probeLine === -1 ? undefined : probeLine

  wrapperOffsets.set(usesAwait, offset)

  return offset
}
