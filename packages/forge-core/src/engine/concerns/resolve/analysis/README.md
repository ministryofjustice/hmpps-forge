# Resolve Analysis

## Scope

This document covers `packages/forge-core/src/engine/concerns/resolve/analysis`.

This code builds the resolve concern's semantic model.
It decides which authored properties are render-facing, how ancestor journey paths compose, which blocks the
step renders, and which MAP iterators stand alone as block producers rather than property values.

This document does not cover expression resolution at runtime or generated resolver code.

## Model Built

`ResolveAnalyzer.analyzeStep()` returns a `ResolveModel` for one step:
- `label`, the script-URL identity segment.
- `step`, the step's render-facing properties in authored order, classified into `AuthoredValue`s with the
  resolve skip props (`onAccess`, `onSubmission`, `blocks`, `reachability`) already excluded.
- `ancestors`, ancestor journeys root-first, each with classified properties and — when every path segment up
  to that ancestor is static — a pre-composed `composedPath`. One dynamic segment poisons the rest of the
  chain, and the generated code then composes every ancestor's path at request time.
- `blocks`, the step's own blocks with classified properties (block skip props excluded) and a precomputed
  `resolvesFieldValue` flag.
- `standaloneIterateBlocks`, the MAP iterators that are not reachable as property values, each with the
  template blocks it yields.

## Rules

- Skip props are analysis knowledge.
  The three sets live on `ResolveAnalyzer`; lowering only materialises the properties it is handed.
- Nested block values are pruned here too.
  Classification marks block-shaped values as `BlockValue` arms; the analyzer rebuilds their entries without
  the block skip props so the compiler never filters keys.
- An iterator reachable as a property value is inline, never standalone.
  `collectInlineIterateIds()` walks every classified tree; a skip-propped iterator never compiles as a value,
  so it stays standalone when it yields blocks.
- The current step is not included in `ancestors`.
  `Ancestry.ancestorsOfType()` excludes the node itself.

## Editing Notes

- To change which authored props are render-facing, start with the skip-prop sets on `ResolveAnalyzer`.
- To change path composition, start in `ResolveAnalyzer.buildAncestors()`.
- To change the inline/standalone partition, start in `ResolveAnalyzer.collectInlineIterateIds()`.

## Entry Points

- [ResolveAnalyzer.ts](ResolveAnalyzer.ts) builds the resolve model for one step.
- [resolveModel.type.ts](../contracts/resolveModel.type.ts) declares the model shape.
