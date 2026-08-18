# Shared Analysis Services

## Scope

This document covers `packages/forge-core/src/engine/chassis/compilation/analysis/shared`.

This code contains AST queries reused by several analysis phases.
It keeps common field, iterate, path, ancestor, and static-data behavior in one place.

This document does not cover phase-specific input assembly.

## Shared Services

`OwnershipIndex` buckets the registered AST by owning step and journey in one constructor pass:
- per journey, its direct step nodes in document order.
- per step, its field blocks, map iterate nodes, and all iterate nodes in document order.

`Ancestry` names the three inheritance patterns behind every ancestor question:
- `valuesRootFirst()` — extracted values root-first, node included (static-data merging, access-hook inheritance).
- `nearestAncestorSetting()` — the nearest configured setting, starting at the node itself (the reachability disable flag).
- `ancestorsOfType()` — matching ancestors root-first, node excluded (resolve's ancestor journeys).

`FieldModelBuilder` classifies step-local form inventory from `OwnershipIndex` buckets into `FieldModel`s:
- registered field blocks, in document order.
- template fields under MAP iterators, with their iterator paths.
- component facts, transformer pipelines, and pre-classified validation rules per occurrence.

`NodeLabeller` derives the script-URL identity segment stamped on each concern model.
- all iterate nodes under a step.

`AuthoredValueClassifier` eagerly classifies authored values into the `AuthoredValue` union — static,
expression, conditional, match, iteration, record, list, and block arms — so lowering consumes typed trees
and never re-derives value kinds at emission time.

`MountInfoAnalyzer` builds mount info:
- `StepMountInfo`, with the step ID and normalized step path.
- `JourneyMountInfo`, with the journey ID and normalized journey path.
- merged static data, via `resolveStaticData()`, which walks the node's `parent` chain root-first.

## Rules

- Ownership is decided by the `parent` chain, indexed once.
  A node belongs to a step when the step appears in its `parent` chain, not because of where its source path looks like it came from.
  `OwnershipIndex` resolves that chain once per node at construction instead of per query.
- `hasConfiguredValue()` treats `undefined` and empty arrays as absent.
  Any other value counts as configured.
- Static data merges from ancestor to descendant.
  Descendant keys override ancestor keys.
- Paths are normalized through `normalizeRelativePath()`.
  Runtime plans should not keep leading slash details from authoring paths.

## Editing Notes

- To change field ownership for any phase, start in `OwnershipIndex`.
- To change how field occurrences are classified, start in `FieldModelBuilder`.
- To change what counts as configured validation, start in `hasConfiguredValue()` in `contracts/models/validationRules.ts`.
- To change static data inheritance, start in `MountInfoAnalyzer.resolveStaticData()`.
- Be careful adding one-off tree scans in phase analyzers.
  If more than one phase needs the same inventory, put it here.

## Entry Points

- [OwnershipIndex.ts](OwnershipIndex.ts) owns the one-pass step/journey ownership buckets.
- [Ancestry.ts](Ancestry.ts) owns the three ancestor-chain patterns.
- [FieldModelBuilder.ts](FieldModelBuilder.ts) owns field-occurrence classification.
- [NodeLabeller.ts](NodeLabeller.ts) owns script-URL label derivation.
- [MountInfoAnalyzer.ts](MountInfoAnalyzer.ts) owns mount info (identity + route path) and static-data facts.
