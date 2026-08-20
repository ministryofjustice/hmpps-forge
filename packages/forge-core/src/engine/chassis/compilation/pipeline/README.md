# Compilation Pipeline

## Scope

This document covers `packages/forge-core/src/engine/chassis/compilation/pipeline`.

This code turns one `JourneyDefinition` into a compilation work pipeline.
It orders the compilation phases, threads `CompilationState`, runs the tree synchronously through the shared work executor, and emits the compilation trace.

`CompilationPipelineBootstrap` is the single source of phase order, the same way `RequestPipelineBootstrap` is for requests.
The phase handlers themselves live with the machinery they drive; this folder decides what runs and when.

This document does not cover phase internals, work execution mechanics, code generation, or runtime request execution.

## Background

The compilation pipeline is the compile-time mirror of the request pipeline.

Both stages describe their phases as `WorkTask`s and run them through the same `WorkExecutor` in [../../work](../../work).
Requests run asynchronously; compilation runs through `executeSyncWithUnit()`, because every compilation handler is synchronous and `compile()` must stay synchronous end to end.
The executor records one trace span per task either way, which is what makes the compilation trace fall out of ordinary execution instead of a separate tracer.

Phases do not pass outputs to each other.
Each phase records what it built onto `CompilationState` and later phases read it back.
The phase order is fixed, so a missing recording is a pipeline bug - the state getters throw rather than return `undefined`.

## Responsibilities

- Build the `CompilationState` draft for one compilation.
- Build and run the root `compilation.pipeline` task.
- Fix the compilation phase order in one place.
- Assemble the final `CompiledPackage` from the recorded state.
- Emit the compilation trace for success and failure through `CompilationPipelineTraceProjector`.
- Unwrap `WorkExecutionError` and rethrow the original phase error.

## Data Model

`CompilationPipeline` accepts `CompilationPipelineOptions`:
- `functionRegistry` and `componentRegistry`, passed into `CompilationState` as the phase dependencies.
- `instrumentation`, optional; when enabled it turns on executor trace fields and the codegen recorder.

`CompilationState` is the mutable draft the phases build up:
- `journeyDefinition` and `dependencies` go in at construction.
- `recordAst()`, `recordModel()`, `recordPackageFunctions()`, and `recordRouteIndexes()` are written by their phases.
- `journeys` and `steps` are filled by the codegen tasks during lowering.
- Getters throw `ForgeInternalError` when read before the owning phase has run.

Like the AST and the `CompilationModel`, the state never leaves compilation.
The pipeline assembles a `CompiledPackage` from it and only that crosses the boundary.

The phase order, fixed in `CompilationPipelineBootstrap` and run by `CompilationPipelineWorkHandler` as one sequential group:

```ts
[
  'dsl-validation', // compilation.dsl-validation
  'ast', // compilation.ast
  'semantic-analysis', // compilation.semantic-analysis
  'analysis', // compilation.analysis
  'lowering', // compilation.lowering
  'routes', // compilation.routes
]
```

Each task key is the work kind minus the `compilation.` prefix, the same rule the request phases follow.

## Flow

`compile()` builds the state and the root task through `CompilationPipelineBootstrap`, runs the tree, emits the trace, and assembles the result.
A phase that throws stops the sequential group; the executor wraps the error in `WorkExecutionError` carrying the partial trace tree.
The pipeline emits an error trace from that tree, then rethrows the original error so callers never see the wrapper.

- [CompilationPipeline.ts](CompilationPipeline.ts) owns execution, trace emission, and result assembly.
- [CompilationPipelineBootstrap.ts](CompilationPipelineBootstrap.ts) owns phase order and state construction.
- [CompilationPipelineWorkHandler.ts](CompilationPipelineWorkHandler.ts) runs the phases the bootstrap built as one sequential group.
- [CompilationState.ts](CompilationState.ts) owns the draft and its read-before-write guards.
- [CompilationPipelineTraceProjector.ts](CompilationPipelineTraceProjector.ts) projects the root span's children into `CompilationTracePhase` entries and serializes each phase's units.
- [../../contracts/compilation/trace.type.ts](../../contracts/compilation/trace.type.ts) defines `CompilationTraceEvent`, the shape the devtools compilation panel consumes.

The phase handlers live with their machinery:
- [../../concerns/dsl-validation/CompilationDslValidationWorkHandler.ts](../../../concerns/dsl-validation/CompilationDslValidationWorkHandler.ts)
- [../ast/CompilationAstWorkHandler.ts](../ast/CompilationAstWorkHandler.ts)
- [../../concerns/semantic-analysis/CompilationSemanticAnalysisWorkHandler.ts](../../../concerns/semantic-analysis/CompilationSemanticAnalysisWorkHandler.ts)
- [../analysis/CompilationAnalysisWorkHandler.ts](../analysis/CompilationAnalysisWorkHandler.ts)
- [../lowering/CompilationLoweringWorkHandler.ts](../lowering/CompilationLoweringWorkHandler.ts), which also owns the journey and step codegen tasks
- [../../concerns/route/analysis/CompilationRoutesWorkHandler.ts](../../../concerns/route/analysis/CompilationRoutesWorkHandler.ts)

## Boundaries

- `CompilationPipelineBootstrap` owns phase creation and ordering.
  It should not execute phases or contain phase logic.
- `CompilationPipelineWorkHandler` owns the root sequential group.
  It should not decide phase order; it runs the phases it receives as props.
- `CompilationPipeline` owns execution and assembly.
  It should not contain phase rules; it reads the finished state and packages it.
- Phase handlers own one phase's orchestration and live with the machinery they drive.
  They read and record `CompilationState`; they should not reach into other phases' recordings before those phases have run.
- `CompilationState` owns cross-phase state.
  It should not carry values only one phase needs.
- `CompilationPipelineTraceProjector` owns trace projection.
  It should not change execution or state.

## Quirks

- dsl-validation runs inside the pipeline, as the first phase.
  It reads only `journeyDefinition`, declared as a structural slice (`DslValidationTarget`) so the concern does not import compilation code.
- On failure the root span is incomplete; the projector completes it during emission so the emitted trace carries a duration either way.
- `journeyCode` is recorded by the AST phase, so error traces from earlier phases emit without one.

## Constraints

- Keep the phase order in `CompilationPipelineBootstrap` and nowhere else.
  Every phase assumes the previous phase's recordings.
- Keep every phase handler synchronous.
  `executeSync()` throws if a handler suspends, and a synchronous `compile()` is part of the public registration API.
- Rethrow the original error, not `WorkExecutionError`.
  Callers and tests match on real error types; the wrapper exists to carry the partial trace to the projector.
- Do not let `CompilationState`, the AST, or the `CompilationModel` leave compilation.
  `CompiledPackage` is the only output.

## Editing Notes

- To change phase order, start in [CompilationPipelineBootstrap.ts](CompilationPipelineBootstrap.ts).
  Check every phase README before moving a phase.
- To add a phase, add its recording to `CompilationState`, add the handler next to its machinery, wire the task here, and add the kind to [workOutput.type.ts](../../contracts/work/workOutput.type.ts).
  Then update the phase-order assertions in [CompilationPipeline.test.ts](CompilationPipeline.test.ts).
- To change trace output, start in [CompilationPipelineTraceProjector.ts](CompilationPipelineTraceProjector.ts).

## Entry Points

- [CompilationPipeline.ts](CompilationPipeline.ts) answers how a `JourneyDefinition` becomes a `CompiledPackage`.
- [CompilationPipelineBootstrap.ts](CompilationPipelineBootstrap.ts) answers what order the phases run in.
- [CompilationState.ts](CompilationState.ts) answers what state phases share and when it becomes readable.
- [CompilationPipelineTraceProjector.ts](CompilationPipelineTraceProjector.ts) answers how compilation work traces are projected for instrumentation.
