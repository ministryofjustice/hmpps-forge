# runtime - execution

Runtime serves HTTP requests. It takes the compiled functions that
[`lowering/`](../lowering/README.md) produced, runs them in a fixed order, and
returns either a rendered page or a redirect. It never sees the AST, never knows
how the functions were built - it just calls them.

## Why a separate layer?

The compiled functions are opaque values. Runtime receives them through
[`contracts/`](../contracts) types (`CompiledRenderFunction`,
`CompiledAccessLifecycleFunction`, etc.) and calls them - it can't inspect their
source, their dependencies, or how they were generated. That isolation means
lowering and runtime can change independently: lowering can rewrite its codegen
without touching the request path, and runtime can restructure its phase
pipeline without touching compilation.

## Follow one GET request

A user visits `/demo/name`. Here's what happens.

[`ForgeRouter`](./routes/ForgeRouter.ts) registered a GET handler for that path
at startup. The handler calls
[`ContextPreparer`](./lifecycle/ContextPreparer.ts) to build a
`RuntimeEvaluationContext` (request, response, and the mutable global state -
answers, data, validation), then hands it to a `RequestOrchestrator`.

The orchestrator ([`RequestOrchestrator.ts`](./orchestrator/RequestOrchestrator.ts))
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
   ForgeResult { type: 'render', context: RenderContext }
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
[`journeyRedirectTerminal`](./orchestrator/terminals/journeyRedirectTerminal.ts)
that evaluates navigation and redirects to the entry step or resume frontier.

The result (`ForgeResult`) is always either `{ type: 'render', context }` or
`{ type: 'redirect', url }`. The framework adapter applies it to the HTTP
response.

## Key files

| File | Role |
|------|------|
| [`routes/ForgeRouter.ts`](./routes/ForgeRouter.ts) | Mounts journey/step GET and POST handlers; wires up orchestrators per step |
| [`routes/RouteTreeBuilder.ts`](./routes/RouteTreeBuilder.ts) | Builds the hierarchical route tree from step/journey route indices |
| [`orchestrator/RequestOrchestrator.ts`](./orchestrator/RequestOrchestrator.ts) | The `for` loop: runs phases in order, halts on redirect/error, falls through to terminal |
| [`orchestrator/types.ts`](./orchestrator/types.ts) | `ForgeResult`, `PhaseOutcome`, `PipelineState`, `RequestPhase`, `TerminalPhase` |
| [`orchestrator/phases/`](./orchestrator/phases/) | `accessLifecyclePhase`, `answerPreparationPhase`, `navigationPhase`, `entryValidationPhase`, `submitPhase` |
| [`orchestrator/terminals/`](./orchestrator/terminals/) | `stepRenderTerminal` (render a step), `journeyRedirectTerminal` (redirect from journey root) |
| [`context/RuntimeEvaluationContext.ts`](./context/RuntimeEvaluationContext.ts) | Request-scoped mutable state: answers, data, validation, reachability |
| [`context/compiledEvaluationContext.ts`](./context/compiledEvaluationContext.ts) | Snapshot builders that extract what each compiled function needs from the full context |
| [`context/EffectFunctionContext.ts`](./context/EffectFunctionContext.ts) | The typed wrapper passed to author-defined effect functions |
| [`lifecycle/ContextPreparer.ts`](./lifecycle/ContextPreparer.ts) | Creates the evaluation context from the HTTP request + static data |
| [`navigation/navigationRedirects.ts`](./navigation/navigationRedirects.ts) | Resolves redirect targets from navigation evaluation (backlink, unreachable, resume) |
| [`rendering/RenderContextFactory.ts`](./rendering/RenderContextFactory.ts) | Hydrates `RenderContext` from render results + validation + route tree |

`runtime/` may depend on `contracts/`, never on `ast/` or `lowering/` - enforced
by eslint, so a stray import fails the build.
