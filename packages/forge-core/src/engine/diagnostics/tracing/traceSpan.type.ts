export type TraceSpanFields = Readonly<Record<string, unknown>>

export interface TraceSpanExecutionSlice {
  readonly startedAtMs: number
  readonly completedAtMs: number
}

export interface TraceSpanReference {
  readonly key: string
  readonly kind: string
  readonly parent?: TraceSpanReference
  readonly children: readonly TraceSpanReference[]
  readonly beginFields: TraceSpanFields
  readonly completeFields: TraceSpanFields
  readonly completed: boolean
  readonly startedAtMs: number
  readonly completedAtMs?: number
  readonly durationMs?: number
  readonly output?: unknown
}

export interface TraceSpanContract extends TraceSpanReference {
  readonly key: string
  readonly kind: string
  readonly parent?: TraceSpanContract
  readonly children: readonly TraceSpanContract[]
  readonly beginFields: TraceSpanFields
  readonly completeFields: TraceSpanFields
  readonly completed: boolean
  readonly startedAtMs: number
  readonly completedAtMs?: number
  readonly durationMs?: number
  readonly selfDurationMs: number
  readonly executionSlices: readonly TraceSpanExecutionSlice[]
  readonly output?: unknown
  readonly omitFromTrace: boolean
}

export interface SerializedTraceSpan {
  readonly key: string
  readonly kind: string
  readonly beginFields: TraceSpanFields
  readonly completeFields: TraceSpanFields
  readonly completed: boolean
  readonly startedAtMs: number
  readonly completedAtMs?: number
  readonly durationMs?: number
  readonly selfDurationMs?: number
  readonly executionSlices?: readonly TraceSpanExecutionSlice[]
  readonly children: readonly SerializedTraceSpan[]
}
