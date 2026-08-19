# Route Analysis

## Scope

This document covers `packages/forge-core/src/engine/concerns/route/analysis`.

This code builds the route concern's compile-time inputs.
It collects the authored `title`, `description`, and `metadata` from each step and journey node for route-metadata lowering, and builds the static route indexes that map every node to its path and ancestor journeys.

This document does not cover metadata resolution or generated code.
The lowering side lives in [../lowering](../lowering/README.md).

## Inputs Built

`RouteAnalyzer.analyzeStep()/analyzeJourney()` returns `RouteMetadataModel` for one step or journey:
- `nodeId`, the node the metadata belongs to.
- `title`, the authored title (required).
- `description` and `metadata`, only when authored.

Steps and journeys carry the same metadata shape, so one analyzer serves both.
`CompilationModelBuilder.build()` calls it for every step and every journey and collects the results into the `routeMetadata` map on the model.

`RouteIndexBuilder` builds the `stepRouteIndex` and `journeyRouteIndex` maps for the compiled package.
Each entry carries the node's authored `path` and its `ancestorJourneyIds`, derived by walking AST `parent` links from the outermost journey down.
`CompilationPipeline.buildRouteIndexes()` calls it after lowering and spreads the indexes onto the `CompiledPackage`.

## Rules

- Copy values as authored, unresolved.
  Titles, descriptions, and metadata can be expressions, so `RouteMetadataCompiler` lowers them and the route-tree runtime phase resolves them per request.
- Collect an entry for every step and every journey.
  That includes container journeys with no direct steps, which the reachability grouping loop never visits.
- Leave unauthored fields `undefined`.
  The compiler only emits `description` and `metadata` when they exist, so absence must survive analysis.

## Editing Notes

- To add a route metadata field, update `RouteMetadataModel` in `contracts/models/compilationModel.type.ts`, then update `RouteAnalyzer` and `RouteMetadataCompiler.compileEntry()` together.
- To change which nodes get entries, start in the route-metadata collection inside `CompilationModelBuilder.build()`.

## Entry Points

- [RouteAnalyzer.ts](RouteAnalyzer.ts) builds route metadata inputs for one step or journey.
- [RouteIndexBuilder.ts](RouteIndexBuilder.ts) builds the step and journey route indexes.
- [CompilationModelBuilder.ts](../../../chassis/compilation/analysis/CompilationModelBuilder.ts) calls `buildInputs()` for every step and journey.
- [../lowering/RouteMetadataCompiler.ts](../lowering/RouteMetadataCompiler.ts) consumes the collected inputs.
