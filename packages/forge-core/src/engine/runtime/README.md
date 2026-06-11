# runtime - execution

Runtime evaluates request snapshots. It takes the compiled functions that
[`lowering/`](../lowering/README.md) produced, runs them in a fixed order, and
returns a `ForgeOutcome` (render, navigate, or error). It never sees the AST,
never knows how the functions were built - it just calls them.

## Why a separate layer?

The compiled functions are opaque values. Runtime receives them through
[`contracts/`](../contracts) types (`CompiledRenderBlockFunction`,
`CompiledAccessHookFunction`, etc.) and calls them - it can't inspect their
source, their dependencies, or how they were generated. That isolation means
lowering and runtime can change independently: lowering can rewrite its codegen
without touching the request path, and runtime can restructure its phase
pipeline without touching compilation.

## Follow one evaluation

A user visits `/demo/name`. The adapter matches the URL against the topology,
builds a `RequestSnapshot`, and calls `forge.evaluate(snapshot)`. Here's what
happens inside the engine.

[`ForgeEvaluator`](./routes/ForgeEvaluator.ts) resolves the matching
`NodeExecutor` for the snapshot's `nodeId`. It wraps the snapshot in a
[`SnapshotStepRequest`](./snapshot/SnapshotStepRequest.ts), then calls
[`ContextPreparer`](./lifecycle/ContextPreparer.ts) to build a
`RuntimeEvaluationContext` (request and the mutable global state - answers,
data, validation) and hands it to a `RequestPipeline` along with the
adapter-provided `ResponseBindings` on the `PipelineState`.

The orchestrator ([`RequestPipeline.ts`](./pipeline/RequestPipeline.ts))
is a `for` loop over an ordered list of phases. Each phase runs a compiled
function, then returns one of three outcomes:

- **`continue`** - move to the next phase
- **`halt-redirect`** - stop the pipeline, return a redirect
- **`halt-error`** - stop the pipeline, throw an HTTP error

For a GET request to a step, the phases are:

```
1. access-lifecycle     run the compiled access hooks (can redirect or deny)
        │ continue
2. answer-preparation   run the compiled answer-prep (format/default answers into state)
        │ continue
3. navigation           run the compiled navigation (evaluate reachability, check step is reachable)
        │ continue
4. entry-validation     run entry validation groups if configured
        │ continue
        ▼
   stepRenderTerminal   run the compiled render → produce blocks, step metadata, backlink
        │
        ▼
   ForgeResult { type: 'render', context }   (orchestrator's internal result)
        │ mapped by ForgeEvaluator
        ▼
   ForgeOutcome { kind: 'render', context, componentRegistry }
```

If any phase halts, the pipeline stops early. For example, if the navigation
phase finds the step is unreachable, it returns `halt-redirect` to the entry
point or frontier - the render terminal never runs.

POST requests use the same orchestrator with a different phase list: the
fourth slot is `submitPhase` (runs submit hooks, validates, branches on
outcomes) instead of `entryValidationPhase`. Both share the same access,
answer-preparation, and navigation phases, and the same render terminal.

Journey root requests (e.g. `/demo/`) use a simpler pipeline: just access +
answer-preparation, with a
[`journeyRedirectTerminal`](./pipeline/terminals/journeyRedirectTerminal.ts)
that evaluates navigation and redirects to the entry step or resume frontier.

The orchestrator's internal result is mapped by `ForgeEvaluator` into a
`ForgeOutcome`: either `{ kind: 'render', context, componentRegistry }`,
`{ kind: 'navigate', url }`, or `{ kind: 'error', error }`. Response IO
(headers, cookies) is handled live by the adapter's `ResponseBindings` during
hook execution, not carried on the outcome.

## Key files

| File | Role |
|------|------|
| [`routes/ForgeEvaluator.ts`](./routes/ForgeEvaluator.ts) | Stores NodeExecutor records keyed by node ID; exposes `evaluate(snapshot)` and `getTopology()` |
| [`snapshot/SnapshotStepRequest.ts`](./snapshot/SnapshotStepRequest.ts) | Wraps a `RequestSnapshot` as a `StepRequest` for the evaluation pipeline |
| [`routes/RouteTreeBuilder.ts`](./routes/RouteTreeBuilder.ts) | Builds the hierarchical route tree from step/journey route indices |
| [`orchestrator/RequestPipeline.ts`](./pipeline/RequestPipeline.ts) | The `for` loop: runs phases in order, halts on redirect/error, falls through to terminal |
| [`orchestrator/types.ts`](./pipeline/types.ts) | `ForgeResult`, `PhaseOutcome`, `PipelineState`, `RequestPhase`, `TerminalPhase` |
| [`orchestrator/phases/`](./pipeline/phases/) | `accessLifecyclePhase`, `answerPreparationPhase`, `navigationPhase`, `entryValidationPhase`, `submitPhase` |
| [`orchestrator/terminals/`](./pipeline/terminals/) | `stepRenderTerminal` (render a step), `journeyRedirectTerminal` (redirect from journey root) |
| [`context/RuntimeEvaluationContext.ts`](./context/RuntimeEvaluationContext.ts) | Request-scoped mutable state: answers, data, validation, reachability |
| [`context/compiledEvaluationContext.ts`](./context/compiledEvaluationContext.ts) | Snapshot builders that extract what each compiled function needs from the full context |
| [`context/EffectFunctionContext.ts`](./context/EffectFunctionContext.ts) | The typed wrapper passed to author-defined effect functions |
| [`lifecycle/ContextPreparer.ts`](./lifecycle/ContextPreparer.ts) | Creates the evaluation context from the snapshot-derived request + static data |
| [`navigation/navigationRedirects.ts`](./navigation/navigationRedirects.ts) | Resolves redirect targets from navigation evaluation (backlink, unreachable, resume) |
| [`rendering/RenderContextFactory.ts`](./rendering/RenderContextFactory.ts) | Hydrates `RenderContext` from render results + validation + route tree |

`runtime/` may depend on `contracts/`, never on `ast/` or `lowering/` - enforced
by eslint, so a stray import fails the build.
