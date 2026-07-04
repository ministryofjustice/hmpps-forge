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
      children: span.children.filter(child => !child.omitFromTrace).map(child => this.serialize(child)),
    }
  }
}
