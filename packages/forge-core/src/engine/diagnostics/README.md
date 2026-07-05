# diagnostics

Diagnostics translate authored DSL positions into stable error context.
The `tracing/` folder holds the trace primitives shared by request and compilation tracing.

AST construction writes source information directly onto nodes:

```ts
node.diagnostics.source.path
node.diagnostics.source.formattedPath
```

There is no side-channel source map and no hidden symbol metadata.

| File | What it does |
|------|--------------|
| [`sourceLocation.type.ts`](./sourceLocation.type.ts) | Shared contracts for DSL path segments, source locations, and AST node diagnostics |
| [`DSLPathFormatter.ts`](./DSLPathFormatter.ts) | Turns a raw path segment array into a human-readable DSL path by resolving journey, step, block, function, and iterator context |
| [`DSLSourceLocator.ts`](./DSLSourceLocator.ts) | Combines a root authored object with `DSLPathFormatter` to create `DSLSourceLocation` values |
| [`DiagnosticErrorFormatter.ts`](./DiagnosticErrorFormatter.ts) | Formats diagnostic fields for error display and appends runtime diagnostic blocks to stack traces |
| [`ForgeTraceSinkDispatcher.ts`](./ForgeTraceSinkDispatcher.ts) | Fans request and compilation trace events out to configured instrumentation sinks; `enabled` is true only when at least one sink is registered; also carries the opt-in `captureGeneratedSource` flag that compilation tracing reads |
| [`tracing/traceSpan.type.ts`](./tracing/traceSpan.type.ts) | Self-contained runtime trace primitives: `TraceSpanFields`, `TraceSpanReference`, `TraceSpanContract`, and the serialized `SerializedTraceSpan` |
| [`tracing/TraceSpan.ts`](./tracing/TraceSpan.ts) | Mutable trace-span node recorded while a work task runs; captures timing, self time, begin/complete fields, output, and `omitFromTrace` |
| [`tracing/TraceSpanSerializer.ts`](./tracing/TraceSpanSerializer.ts) | Serializes a `TraceSpan` tree into `SerializedTraceSpan` trace data and drops children marked `omitFromTrace` |
| [`tracing/compilationTrace.type.ts`](./tracing/compilationTrace.type.ts) | Contracts for a compilation trace: `CompilationTrace`, `CompilationTracePhase`, `CompilationTraceError`, and the `CompilationTraceEvent` fanned out per package registration |
| [`tracing/CompilationTracer.ts`](./tracing/CompilationTracer.ts) | Records per-phase spans while a package compiles and captures the overall compile outcome and timing |
| [`tracing/CompilationTraceProjector.ts`](./tracing/CompilationTraceProjector.ts) | Projects a recorded compilation trace into a `CompilationTraceEvent` for the instrumentation sinks |
