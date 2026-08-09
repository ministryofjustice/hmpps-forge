# Route Tree Compiler

## Scope

This document covers `packages/forge-core/src/engine/concerns/route/lowering`.

This code compiles the package's dynamic route metadata.
It emits a `CompiledRouteMetadataFunction` that returns resolved title/description/metadata keyed by node ID.

This document does not cover the static route topology (built once at mount) or the route-tree runtime phase that merges metadata onto it.

## Inputs

`RouteMetadataCompiler.compile()` receives the collected `RouteMetadataCompilationInputs` for every step and journey:
- the node ID.
- the authored `title` (required), `description`, and `metadata`.

Dependency analysis (`RouteMetadataInputAnalyzer`) provides those inputs.

## Output

The compiled function returns one object keyed by node ID:
- `result[nodeId] = { title, description?, metadata? }`.

The route-tree runtime phase calls it once per request and merges the result onto the hydrated topology.

## Rules

- Unlike per-step phase compilers, this one is compiled once at **package scope** — the route tree spans every node — then fanned onto every compiled step and journey.
- Title, description, and metadata are evaluated through `RuntimeValueCompiler`.
  Static values emit as literals; dynamic values emit as expression-backed assignments.
- Expression failures **throw** (`expressionErrorMode: 'throw'`), tagged with the `route-tree` phase, matching how resolve treats authored expressions.
- `description` and `metadata` are only emitted when authored, so absent fields stay absent on the resolved entry.

## Editing Notes

- To change the resolved entry shape, start in `compileEntry()`.
- To change static-versus-dynamic value handling, start in the `RuntimeValueCompiler` policy in the constructor.
- To inspect generated source, use `generateSource()` in the tests.

## Entry Points

- [RouteMetadataCompiler.ts](RouteMetadataCompiler.ts) emits route-metadata source and compiles it.
