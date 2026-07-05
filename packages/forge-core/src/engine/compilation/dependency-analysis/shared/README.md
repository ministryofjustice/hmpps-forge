# Shared Dependency Analyzers

## Scope

This document covers `packages/forge-core/src/engine/compilation/dependency-analysis/shared`.

This code contains AST queries reused by several dependency-analysis phases.
It keeps common field, iterate, path, ancestor, and static-data behavior in one place.

This document does not cover phase-specific input assembly.

## Shared Analyzers

`FieldInventoryAnalyzer` finds step-local form inventory:
- all field blocks under a step.
- validating field blocks under a step.
- map iterate nodes under a step.
- all iterate nodes under a step.
- field inventory sources for reachability entries.

`RuntimePlanAnalyzer` builds runtime metadata:
- `StepRuntimePlan`, with the step ID and normalized step path.
- `JourneyRuntimePlan`, with the journey ID and normalized journey path.
- merged static data, via `resolveStaticData()`, which walks the node's `parent` chain root-first.

## Rules

- Ownership is a `parent` pointer walk.
  A node belongs to a step when the step appears in its `parent` chain, not because of where its source path looks like it came from.
- `hasConfiguredValue()` treats `undefined` and empty arrays as absent.
  Any other value counts as configured.
- Static data merges from ancestor to descendant.
  Descendant keys override ancestor keys.
- Paths are normalized through `normalizeRelativePath()`.
  Runtime plans should not keep leading slash details from authoring paths.

## Editing Notes

- To change field ownership for any phase, start in `FieldInventoryAnalyzer.findFieldBlocksForStep()`.
- To change what counts as configured validation, start in `FieldInventoryAnalyzer.hasConfiguredValue()`.
- To change static data inheritance, start in `RuntimePlanAnalyzer.resolveStaticData()`.
- Be careful adding one-off tree scans in phase analyzers.
  If more than one phase needs the same inventory, put it here.

## Entry Points

- [FieldInventoryAnalyzer.ts](FieldInventoryAnalyzer.ts) owns shared field and iterate inventory queries.
- [RuntimePlanAnalyzer.ts](RuntimePlanAnalyzer.ts) owns runtime path and static-data plan facts.
