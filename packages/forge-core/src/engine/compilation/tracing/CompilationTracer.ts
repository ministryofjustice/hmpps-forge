import TraceSpan from '../../tracing/TraceSpan'
import type { TraceSpanFields } from '../../tracing/traceSpan.type'

export interface CompilationTracerOptions {
  readonly enabled?: boolean
  readonly captureGeneratedSource?: boolean
}

/**
 * Builds the compilation trace tree while a package is compiled.
 *
 * Synchronous-only by design: compilation never awaits, so a plain
 * current-parent stack is enough to nest spans correctly — there is no
 * interleaving to account for as there is in the runtime request pipeline.
 */
export default class CompilationTracer {
  /**
   * Shared no-op tracer. The disabled path touches no state, so a single
   * instance can back every compilation that does not want tracing.
   */
  static readonly disabled = new CompilationTracer()

  private readonly rootTraceSpan?: TraceSpan

  private readonly captureGeneratedSourceOption: boolean

  private readonly spanStack: TraceSpan[] = []

  private mutableJourneyCode: string | undefined

  constructor(options: CompilationTracerOptions = {}) {
    this.rootTraceSpan = options.enabled === true ? new TraceSpan('compile-package', 'compilation.package') : undefined
    this.captureGeneratedSourceOption = options.captureGeneratedSource === true
  }

  get enabled(): boolean {
    return this.rootTraceSpan !== undefined
  }

  get captureGeneratedSource(): boolean {
    return this.enabled && this.captureGeneratedSourceOption
  }

  get root(): TraceSpan | undefined {
    return this.rootTraceSpan
  }

  get journeyCode(): string | undefined {
    return this.mutableJourneyCode
  }

  recordJourneyCode(code: string): void {
    if (!this.enabled) {
      return
    }

    this.mutableJourneyCode = code
  }

  span<T>(key: string, kind: string, run: (span: TraceSpan | undefined) => T, beginFields?: TraceSpanFields): T {
    const root = this.rootTraceSpan

    if (root === undefined) {
      return run(undefined)
    }

    const parent = this.spanStack[this.spanStack.length - 1] ?? root
    const span = new TraceSpan(key, kind, parent)

    parent.addChild(span)

    if (beginFields !== undefined) {
      span.recordTraceMetadataAtStart(beginFields)
    }

    this.spanStack.push(span)

    try {
      const output = run(span)

      // A throw skips this: the span stays incomplete, which reads like failed
      // runtime work rather than a zero-duration success.
      this.completeSpan(span, output)

      return output
    } finally {
      this.spanStack.pop()
    }
  }

  completeRoot(): void {
    if (this.rootTraceSpan === undefined || this.rootTraceSpan.completed) {
      return
    }

    this.completeSpan(this.rootTraceSpan, undefined)
  }

  private completeSpan(span: TraceSpan, output: unknown): void {
    span.complete(output)

    const childrenDurationMs = span.children.reduce((total, child) => total + (child.durationMs ?? 0), 0)

    // Compilation is synchronous, so subtracting direct children's durations is
    // an exact self time rather than an approximation.
    span.addSelfTime(Math.max(0, (span.durationMs ?? 0) - childrenDurationMs))
  }
}
