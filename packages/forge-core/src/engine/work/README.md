# Work

## Scope

This document covers `packages/forge-core/src/engine/work`.

This code runs `WorkTask` trees for both engine stages.
It executes work handlers, drains child groups, records trace units, and returns completed work output.
The runtime request pipeline runs through it asynchronously; the compilation pipeline runs through it synchronously.

This document does not cover request phase ordering, compilation phase ordering, phase-specific business rules, compiled function generation, or component rendering.

## Background

Work is the execution model behind both a Forge request and a package compilation.

Compiled functions, request phases, and compilation phases do not usually do all of their child work directly.
They describe that work as `WorkTask`s.
For example, a compiled validation function returns one `validation.step` task that contains field and domain validation tasks.
The request pipeline itself is one `request.pipeline` task with ordered request-phase children.
The compilation pipeline is one `compilation.pipeline` task with ordered compilation-phase children.

That shape matters because the engine needs one consistent way to run nested work.
Some children must run in order.
Some can run concurrently.
Some stop at the first useful result, like hook branches and request phases.
The raw function output is not enough because it does not tell the executor how to order children, how to fold child outputs, or how to record a trace.

This is not a job queue.
`WorkExecutor` runs an in-memory tree for one request or one compilation.
It does not persist work, retry work, or schedule work outside the current tree.

## Responsibilities

- Create branded `WorkTask` values.
- Execute a `WorkTask` by calling its `WorkHandler`.
- Drain child `WorkGroup`s in `sequential`, `concurrent`, or `first-match` mode.
- Pass a scoped `WorkContext` to every handler.
- Fold child outputs through the parent handler's `complete()` method.
- Record `TraceSpan` trace nodes as the tree runs.
- Stay synchronous while every handler stays synchronous, and reject suspension in `executeSync()`.
- Replace nested `WorkTask` props with completed outputs when a handler needs renderable values.
- Preserve partial trace state when execution fails.

## Data Model

The core contracts live in [work.type.ts](../contracts/work/work.type.ts).

`WorkTask<K, TProps>` is the executable description.
It contains:
- `$$typeof`, the `FORGE_WORK` brand used by `isWorkTask()`.
- `key`, the task key within its siblings.
- `handler`, the `WorkHandler` that knows how to run the task.
- `props`, the handler input.
- `instrumentation`, optional trace metadata hooks.

`WorkHandler<K, TProps>` owns behavior for one work kind.
Its `begin(ctx)` returns either an `output` or child `groups`.
Its optional `complete(ctx, children)` folds completed child work into the handler output.

`WorkBegin` has two arms:
- `{ output }`, for leaf work.
- `{ groups }`, for parent work that needs children.

`WorkGroup` controls child execution:
- `sequential` runs every child in declaration order.
- `concurrent` starts every child together and preserves declaration order in the completed output array.
- `first-match` runs children in order and stops when `matches(completedWork)` returns `true`.

`CompletedWork` is the immutable result returned by the executor.
It contains the task `key`, handler `kind`, handler `output`, and completed child results.

`TraceSpan` is the mutable trace node created while a task runs.
It records key, kind, parent, children, timing, begin fields, complete fields, output, and `omitFromTrace`.

`WorkContext` carries the stage context and the current task props.
The stage context is generic: runtime puts `RequestState` in the slot, compilation puts `CompilationState` in it.
`withWork()` creates a new context for one work unit, with the same stage context and different work props.

`WorkOutputByKind` in [workOutput.type.ts](../contracts/work/workOutput.type.ts) maps each known work kind to its output type.
This keeps handler outputs and child-output readers aligned.
Unknown string kinds still run, but their output type is `unknown`.

### Example

A parent handler can describe two child tasks and fold their results:

```ts
const childHandler: WorkHandler<'example.child', { readonly value: string }> = {
  kind: 'example.child',
  begin: ctx => ({ output: ctx.props.value }),
}

const parentHandler: WorkHandler<'example.parent'> = {
  kind: 'example.parent',
  begin: () => ({
    groups: [
      {
        mode: 'sequential',
        children: [
          createWorkTask('first', childHandler, { value: 'one' }),
          createWorkTask('second', childHandler, { value: 'two' }),
        ],
      },
    ],
  }),
  complete: (_ctx, children) => children.map(child => child.output),
}
```

`WorkExecutor.execute()` turns that task tree into completed work:

```jsonc
{
  "key": "parent",
  "kind": "example.parent",
  "output": ["one", "two"],
  "children": [
    { "key": "first", "kind": "example.child", "output": "one", "children": [] },
    { "key": "second", "kind": "example.child", "output": "two", "children": [] }
  ]
}
```

The important transform is from a description of work to completed output.
The executor owns the ordering and the child folding.
The handler owns the domain meaning of the output.

## Flow

Work execution starts when a stage calls `WorkExecutor.execute()`, `executeWithUnit()`, `executeSync()`, or `executeSyncWithUnit()` with a root `WorkTask` and root `WorkContext`.
Each task creates one `TraceSpan`, runs `begin()`, executes any child groups, then runs `complete()` or returns the begin output.

Execution is thenable-aware: one recursion serves both stages.
A step stays synchronous until a handler actually returns a promise, and only then does the surrounding execution become asynchronous.
`executeSync()` and `executeSyncWithUnit()` use the same recursion and throw `ForgeInternalError` if any handler suspends - compilation handlers are all synchronous, so a promise there is a bug, not an outcome.

```mermaid
flowchart TD
  task["WorkTask"] -->|execute root task| executor["WorkExecutor.execute()"]
  executor -->|create trace node| traceSpan["TraceSpan"]
  traceSpan -->|scope stage context + props| workContext["WorkContext.withWork()"]
  workContext -->|record start metadata| startTrace["resolveTraceMetadataAtStart()"]
  startTrace -->|run handler| begin["WorkHandler.begin()"]
  begin --> hasGroups{"Child groups?"}
  hasGroups -->|no| beginOutput["Use begin output"]
  hasGroups -->|yes| executeGroups["executeGroup()"]
  executeGroups --> sequential["sequential: run children in order"]
  executeGroups --> concurrent["concurrent: run children together"]
  executeGroups --> firstMatch["first-match: stop on matches()"]
  sequential --> completedChildren["CompletedWork[]"]
  concurrent --> completedChildren
  firstMatch --> completedChildren
  completedChildren --> complete["WorkHandler.complete()"]
  beginOutput --> finishTrace["resolveTraceMetadataAtFinish()"]
  complete --> finishTrace
  finishTrace -->|mark unit complete| completedWork["CompletedWork"]
```

- [WorkExecutor.ts](WorkExecutor.ts) owns the execution loop.
  `execute()` returns `CompletedWork`; `executeWithUnit()` also returns the root `TraceSpan` and wraps failures in `WorkExecutionError`.
  `executeSync()` and `executeSyncWithUnit()` are the synchronous pair used by compilation.
- [WorkContext.ts](WorkContext.ts) carries the stage context, current props, and current `TraceSpan`.
  `withWork()` keeps the stage context shared while giving each task its own props and trace node.
- [TraceSpan.ts](../tracing/TraceSpan.ts) records the trace tree.
  It is mutable while work runs and read later by trace projection.
- [workTask.ts](workTask.ts) creates branded tasks and provides child-output helpers such as `singleChildOutput()`, `childOutputs()`, and `findChildByTask()`.
- [WorkTaskPropsWalker.ts](WorkTaskPropsWalker.ts) finds nested `WorkTask`s inside plain props and replaces them with completed outputs.
  Resolve uses it when block props contain nested render work.
- [TraceSpanSerializer.ts](../tracing/TraceSpanSerializer.ts) turns a `TraceSpan` tree into trace data and drops children marked `omitFromTrace`.

Task creation for a known kind lives with that kind's handler: each handler file exports a `create<X>Task` function wiring its handler, props, key, and instrumentation together. The builders generated functions need are assembled as `workTaskBuilders` in [compiledEvaluationContext.ts](../runtime/context/compiledEvaluationContext.ts), which generated source calls through `ctx.workTasks`.
Compilation builds its tasks directly in its phase handlers.

## Boundaries

- This folder is stage-neutral.
  It may import only `tracing/`, `contracts/`, and `errors/` - never `compilation/`, `runtime/`, or `concerns/`.
  The eslint zone in [eslint.config.mjs](../../../eslint.config.mjs) enforces this.
- `WorkExecutor` owns execution order.
  It should not know request phases, compilation phases, validation rules, hook semantics, or rendering rules.
- `WorkHandler` implementations own domain behavior and live with their stage or concern.
  They should return `WorkBegin` from `begin()` and fold child outputs in `complete()`.
- `workTask.ts` owns generic task helpers and type guards.
  It should not import phase handlers.
- `WorkContext` owns stage-context and props threading.
  It should not clone stage state or isolate phase state.
- `TraceSpan` owns trace state.
  It should not decide which request outcome or phase output is correct.
- `WorkTaskPropsWalker` owns positional task collection and output replacement inside plain props.
  It should not execute tasks.

## Quirks

- `execute()` and `executeWithUnit()` differ only in failure shape and trace access.
  `executeWithUnit()` is used when callers need the partial `TraceSpan` tree after a failure.
- Execution only goes asynchronous when a handler does.
  A fully synchronous subtree runs to completion without touching the microtask queue, which also means synchronous children in a `concurrent` group run serially and never interleave.
- `concurrent` groups preserve child declaration order in results.
  Children with asynchronous handlers run together, but the completed array still lines up with the original children.
- `first-match` is sequential.
  It stops after the first completed child that matches. It never starts later children.
- A work unit is left incomplete when `begin()`, child execution, `complete()`, or instrumentation throws.
  This is deliberate so failed traces can show where execution stopped.
- `WorkTaskPropsWalker` matches completed work by position, then checks key and kind.
  Generated compiler output should normally give sibling tasks distinct keys, but the walker still tolerates duplicate keys so nested prop replacement stays deterministic.
- `WorkTaskPropsWalker` only walks arrays and plain records.
  It ignores dates, class instances, primitives, malformed task-like objects, and task props below a valid task boundary.
- `omitFromTrace()` is best effort.
  It only works when the current context has a real `TraceSpan`.

## Constraints

- Keep `begin()` before child execution and `complete()` after child execution.
  Reordering this would break every parent handler that expects completed child outputs in `complete()`.
- Do not run `first-match` children concurrently.
  Later children must not start after an earlier child has produced a terminal result.
- Preserve child result order for `sequential` and `concurrent` groups.
  `WorkTaskPropsWalker.replaceCompletedOutputs()` depends on the completed work array matching collection order.
- Do not swallow handler or instrumentation errors.
  Both stages need real failures, and the `WithUnit` variants need to carry the partial tree through `WorkExecutionError`.
- Only use `TraceSpan` as the parent trace object inside `WorkExecutor`.
  A foreign `TraceSpanReference` cannot be mutated safely into the trace tree.
- Keep task branding on `FORGE_WORK`.
  `isWorkTask()` and `WorkTaskPropsWalker` use the brand to distinguish work tasks from render blocks and ordinary records.
- Do not expose `TraceSpan` as the stable output of execution.
  `CompletedWork` is the execution result; `TraceSpan` is trace state.
- Do not import stage code into this folder.
  The executor serves both stages precisely because it knows neither.

## Editing Notes

- To add a new work kind, start in [workOutput.type.ts](../contracts/work/workOutput.type.ts).
  Add the output entry, then add or update the handler that owns the kind.
- To add a new handler, follow the existing handler shape.
  Declare a literal `kind`, implement `begin()`, and implement `complete()` only when the handler has children to fold.
- To create a task for a known runtime handler, add a `create<X>Task` function to that handler's file; if generated functions need it, add it to `workTaskBuilders` in [compiledEvaluationContext.ts](../runtime/context/compiledEvaluationContext.ts).
  Compilation handlers call `createWorkTask()` directly.
- To add trace metadata for a task, add a `WorkInstrumentation` object beside the handler.
  Keep metadata small and serializable.
- To change group execution behavior, start in [WorkExecutor.ts](WorkExecutor.ts).
  Update tests for order, failure state, trace shape, and synchronous execution at the same time.
- To read child outputs, use `singleChildOutput()`, `childOutputs()`, or `findChildByTask()`.
  Do not hand-cast `CompletedWork.output` in handlers unless the generic helper cannot express the lookup.
- To support nested tasks inside props, use [WorkTaskPropsWalker.ts](WorkTaskPropsWalker.ts).
  Keep collect and replacement traversal aligned, or duplicate keys can pair with the wrong output.
- To change trace projection, start in [TraceSpanSerializer.ts](../tracing/TraceSpanSerializer.ts).
  Do not put trace serialization rules in `WorkExecutor`.

## Entry Points

- [WorkExecutor.ts](WorkExecutor.ts) answers how a `WorkTask` tree is executed, asynchronously or synchronously.
- [workTask.ts](workTask.ts) answers how work tasks are created, identified, and read from completed children.
- [WorkContext.ts](WorkContext.ts) answers how stage context and task props are threaded through execution.
- [TraceSpan.ts](../tracing/TraceSpan.ts) answers how the live trace tree is recorded.
- [WorkExecutionError.ts](WorkExecutionError.ts) answers how a failed execution carries the partial work tree.
- [WorkTaskPropsWalker.ts](WorkTaskPropsWalker.ts) answers how nested work tasks inside props are collected and replaced.
- [TraceSpanSerializer.ts](../tracing/TraceSpanSerializer.ts) answers how live work units become trace output.
- [../runtime/context/compiledEvaluationContext.ts](../runtime/context/compiledEvaluationContext.ts) answers which task builders generated functions can reach through `ctx.workTasks`; each builder lives beside the handler it creates tasks for.
- [../contracts/work/work.type.ts](../contracts/work/work.type.ts) defines `WorkTask`, `WorkHandler`, `WorkBegin`, `WorkGroup`, and `CompletedWork`.
- [../tracing/traceSpan.type.ts](../tracing/traceSpan.type.ts) defines `TraceSpanContract`, `TraceSpanReference`, `TraceSpanFields`, and `SerializedTraceSpan`.
- [../contracts/work/workOutput.type.ts](../contracts/work/workOutput.type.ts) maps work kinds to their output types.
