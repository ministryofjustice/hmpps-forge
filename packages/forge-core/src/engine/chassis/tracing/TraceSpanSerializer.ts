import type { SerializedTraceSpan, TraceSpanContract } from './traceSpan.type'

export default class TraceSpanSerializer {
  serialize(span: TraceSpanContract): SerializedTraceSpan {
    return {
      key: span.key,
      kind: span.kind,
      beginFields: span.beginFields,
      completeFields: span.completeFields,
      completed: span.completed,
      startedAtMs: span.startedAtMs,
      completedAtMs: span.completedAtMs,
      durationMs: span.durationMs,
      selfDurationMs: span.selfDurationMs,
      // TraceSpan is shared with compilation tracing, which never records slices — keep those spans clean.
      ...(span.executionSlices.length > 0 ? { executionSlices: span.executionSlices } : {}),
      children: span.children.filter(child => !child.omitFromTrace).map(child => this.serialize(child)),
    }
  }
}
