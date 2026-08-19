# tracing

Tracing is the shared substrate both stages record into: a mutable span primitive, a serializer that turns a
finished span tree into trace data, and the sink dispatcher that fans finished traces out to configured
instrumentation.

The substrate itself is stage-neutral. Spans are recorded by the work executor in [`../work`](../work) as tasks run - for both stages. Each stage owns its own projection:

- [`../compilation/pipeline/CompilationPipelineTraceProjector.ts`](../compilation/pipeline/CompilationPipelineTraceProjector.ts) projects a finished compilation into a `CompilationTraceEvent`.
- [`../runtime/pipeline/RequestPipelineTraceProjector.ts`](../runtime/pipeline/RequestPipelineTraceProjector.ts) projects a finished request pipeline into a `RequestTraceEvent`.

Source-location diagnostics - DSL path formatting and the source locations attached to AST nodes during
compilation - are a separate subsystem and live in [`../../shared/diagnostics`](../../shared/diagnostics).

| File | What it does |
|------|--------------|
| [`traceSpan.type.ts`](./traceSpan.type.ts) | Self-contained runtime trace primitives: `TraceSpanFields`, `TraceSpanReference`, `TraceSpanContract`, and the serialized `SerializedTraceSpan` |
| [`TraceSpan.ts`](./TraceSpan.ts) | Mutable trace-span node recorded while a work task runs; captures timing, self time, begin/complete fields, output, and `omitFromTrace` |
| [`TraceSpanSerializer.ts`](./TraceSpanSerializer.ts) | Serializes a `TraceSpan` tree into `SerializedTraceSpan` trace data and drops children marked `omitFromTrace` |
| [`ForgeTraceSinkDispatcher.ts`](./ForgeTraceSinkDispatcher.ts) | Fans request and compilation trace events out to configured instrumentation sinks; `enabled` is true only when at least one sink is registered |
