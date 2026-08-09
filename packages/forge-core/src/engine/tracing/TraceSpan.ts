import type { TraceSpanContract, TraceSpanExecutionSlice, TraceSpanFields } from './traceSpan.type'

export default class TraceSpan implements TraceSpanContract {
  private readonly spanKey: string

  private readonly spanKind: string

  private readonly parentTraceSpan?: TraceSpan

  private readonly childTraceSpans: TraceSpan[] = []

  private readonly mutableStartedAtMs = performance.now()

  private mutableBeginFields: TraceSpanFields = {}

  private mutableCompleteFields: TraceSpanFields = {}

  private mutableCompleted = false

  private mutableCompletedAtMs: number | undefined

  private mutableDurationMs: number | undefined

  private mutableSelfDurationMs = 0

  private readonly mutableExecutionSlices: TraceSpanExecutionSlice[] = []

  private mutableOutput: unknown

  private mutableOmitFromTrace = false

  constructor(key: string, kind: string, parent?: TraceSpan) {
    this.spanKey = key
    this.spanKind = kind
    this.parentTraceSpan = parent
  }

  get key(): string {
    return this.spanKey
  }

  get kind(): string {
    return this.spanKind
  }

  get parent(): TraceSpan | undefined {
    return this.parentTraceSpan
  }

  get children(): readonly TraceSpan[] {
    return this.childTraceSpans
  }

  get beginFields(): TraceSpanFields {
    return this.mutableBeginFields
  }

  get completeFields(): TraceSpanFields {
    return this.mutableCompleteFields
  }

  get completed(): boolean {
    return this.mutableCompleted
  }

  get startedAtMs(): number {
    return this.mutableStartedAtMs
  }

  get completedAtMs(): number | undefined {
    return this.mutableCompletedAtMs
  }

  get durationMs(): number | undefined {
    return this.mutableDurationMs
  }

  get selfDurationMs(): number {
    return this.mutableSelfDurationMs
  }

  get executionSlices(): readonly TraceSpanExecutionSlice[] {
    return this.mutableExecutionSlices
  }

  get output(): unknown {
    return this.mutableOutput
  }

  get omitFromTrace(): boolean {
    return this.mutableOmitFromTrace
  }

  addChild(childTraceSpan: TraceSpan): void {
    this.childTraceSpans.push(childTraceSpan)
  }

  addSelfTime(ms: number): void {
    this.mutableSelfDurationMs += ms
  }

  recordExecutionSlice(startedAtMs: number, completedAtMs: number): void {
    this.mutableExecutionSlices.push({ startedAtMs, completedAtMs })
  }

  recordTraceMetadataAtStart(traceMetadata: TraceSpanFields | undefined): void {
    this.mutableBeginFields = traceMetadata ?? {}
  }

  recordTraceMetadataAtFinish(traceMetadata: TraceSpanFields | undefined): void {
    this.mutableCompleteFields = traceMetadata ?? {}
  }

  complete(output: unknown): void {
    const completedAtMs = performance.now()

    this.mutableOutput = output
    this.mutableCompleted = true
    this.mutableCompletedAtMs = completedAtMs
    this.mutableDurationMs = completedAtMs - this.mutableStartedAtMs
  }

  markOmitFromTrace(): void {
    this.mutableOmitFromTrace = true
  }
}
