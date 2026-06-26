# Resolve Inputs

## Scope

This document covers `packages/forge-core/src/engine/compilation/dependency-analysis/resolve`.

This code builds the dependency-analysis inputs for resolve lowering.
It gives resolve compilation the current step, its ancestor journeys, and every iterate node under the step.

This document does not cover expression resolution at runtime or generated resolver code.

## Inputs Built

`ResolveInputAnalyzer.buildInputs()` returns `ResolveInputs` for one step:
- `stepNode`, the step being compiled.
- `ancestorJourneys`, all journey ancestors from outermost to innermost.
- `allIterateNodes`, every `ExpressionType.ITERATE` node that descends from the step.

Resolve uses all iterate nodes, not only map iterates.
Filter and find iterators can also affect what resolution needs to compile.

## Rules

- Ancestor journeys are resolved from `ASTNodeTree`.
  Do not infer them from route paths.
- The current step is not included in `ancestorJourneys`.
  `resolveAncestorJourneys()` slices the ancestor chain before filtering journeys.
- Include every iterator kind.
  Resolve needs a broader iterator inventory than answer preparation or validation.

## Editing Notes

- To change journey ancestry behavior, start in `ResolveInputAnalyzer.resolveAncestorJourneys()`.
- To change iterate selection, start in `FieldInventoryAnalyzer.findAllIterateNodesForStep()`.
- If resolve starts needing blocks or hooks directly, add those fields to `ResolveInputs` before querying them in lowering.

## Entry Points

- [ResolveInputAnalyzer.ts](ResolveInputAnalyzer.ts) builds resolve inputs for one step.
- [../shared/FieldInventoryAnalyzer.ts](../shared/FieldInventoryAnalyzer.ts) owns all-iterate lookup.
