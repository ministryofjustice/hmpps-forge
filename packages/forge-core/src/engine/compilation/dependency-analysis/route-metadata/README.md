# Route Metadata Inputs

## Scope

This document covers `packages/forge-core/src/engine/compilation/dependency-analysis/route-metadata`.

This code builds the dependency-analysis inputs for route-metadata lowering.
It collects the authored `title`, `description`, and `metadata` from each step and journey node.

This document does not cover metadata resolution or generated code.
The lowering side lives in `lowering/phase-compilers/route-tree` - named after the runtime phase that consumes the compiled function, not after this analyzer.

## Inputs Built

`RouteMetadataInputAnalyzer.buildInputs()` returns `RouteMetadataCompilationInputs` for one step or journey:
- `nodeId`, the node the metadata belongs to.
- `title`, the authored title (required).
- `description` and `metadata`, only when authored.

Steps and journeys carry the same metadata shape, so one analyzer serves both.
`CompilationPlanBuilder.buildPlan()` calls it for every step and every journey and collects the results into the `routeMetadataInputs` map on the plan.

## Rules

- Copy values as authored, unresolved.
  Titles, descriptions, and metadata can be expressions, so `RouteMetadataCompiler` lowers them and the route-tree runtime phase resolves them per request.
- Collect an entry for every step and every journey.
  That includes container journeys with no direct steps, which the reachability grouping loop never visits.
- Leave unauthored fields `undefined`.
  The compiler only emits `description` and `metadata` when they exist, so absence must survive analysis.

## Editing Notes

- To add a route metadata field, update `RouteMetadataCompilationInputs` in `contracts/plans/compilationPlan.type.ts`, then update `RouteMetadataInputAnalyzer` and `RouteMetadataCompiler.compileEntry()` together.
- To change which nodes get entries, start in the route-metadata loops at the end of `CompilationPlanBuilder.buildPlan()`.

## Entry Points

- [RouteMetadataInputAnalyzer.ts](RouteMetadataInputAnalyzer.ts) builds route metadata inputs for one step or journey.
- [../CompilationPlanBuilder.ts](../CompilationPlanBuilder.ts) calls `buildInputs()` for every step and journey.
- [../../lowering/phase-compilers/route-tree/RouteMetadataCompiler.ts](../../lowering/phase-compilers/route-tree/RouteMetadataCompiler.ts) consumes the collected inputs.
