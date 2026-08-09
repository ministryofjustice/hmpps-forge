# Compilation Tracing

## Scope

This document covers `packages/forge-core/src/engine/compilation/tracing`.

This code records what happened while a package compiled and projects it into a `CompilationTraceEvent` for
instrumentation sinks.

This document does not cover the span primitive, the serializer, or the sink dispatcher - those are the shared
substrate in [`../../tracing`](../../tracing). It also does not cover request tracing, whose twin projector is
[`../../runtime/evaluation/request/RequestPipelineTraceProjector.ts`](../../runtime/evaluation/request/RequestPipelineTraceProjector.ts).

## What Gets Recorded

`CompilationTracer` builds a span tree under one `compile-package` root:

- `span(key, kind, run)` wraps a compile step, nests it under the current parent, and completes it with the step's output.
  A throw leaves the span incomplete, which reads as failed work rather than a zero-duration success.
- Self time is exact rather than approximate, because compilation is synchronous - a plain current-parent stack is enough, with no interleaving to account for.
- `recordJourneyCode()` tags the trace with the journey being compiled.
- The tracer is off by default. `CompilationTracer.disabled` is a shared no-op instance, and `captureGeneratedSource` is a separate opt-in that generated-function construction reads before attaching source.

## Projection

`PackageInstance.compile()` owns the wiring: it constructs the tracer from the instrumentation options, passes it
down through the compilation pipeline, then calls `CompilationTraceProjector.emit()` on both the success and the
failure path.

The projector turns the root's direct children into `CompilationTracePhase` entries - phase name (the
`compilation.` prefix stripped from the span kind), timing, and the serialized units below it - and hands the
result to `instrumentation.onCompilationTrace()`. It emits nothing when instrumentation is disabled or the root
recorded no children.

## Editing Notes

- To change what a phase records, start in the `span()` call sites in `CompilationPipeline` and `CodegenOrchestrator`, not here.
- To change the emitted event shape, start in [compilationTrace.type.ts](compilationTrace.type.ts) and `CompilationTraceProjector.project()`.
- To change how a single unit serializes, start in [`../../tracing/TraceSpanSerializer.ts`](../../tracing/TraceSpanSerializer.ts) - it is shared with request tracing, so a change lands on both.
