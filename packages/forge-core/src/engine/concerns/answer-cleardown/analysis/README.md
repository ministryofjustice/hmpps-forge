# Answer Cleardown Inputs

## Scope

This document covers `packages/forge-core/src/engine/concerns/answer-cleardown/analysis`.

This code builds the dependency-analysis inputs for the field inventory lowering phase.
It selects, for every step in a journey's reachability plan, the field blocks and map iterates that can produce answers, and carries the step's authored cleardown patterns alongside them.

This document does not cover the cleardown algorithm or how the compiled inventory is evaluated at request time.

## Inputs Built

`AnswerCleardownInputAnalyzer.buildInputs()` returns `AnswerCleardownInputs` for one journey:
- `fieldInventorySources`, one entry per step in the reachability plan, each carrying the step ID, its field blocks, its `IteratorType.MAP` iterate nodes, and its `cleardownFieldCodes`.

Field and iterate lookup is delegated to `FieldInventoryAnalyzer`.

## Rules

- Build one source per reachability plan entry, in plan order.
  The compiled inventory reports every step in the journey, reachable or not.
- Include only map iterates.
  Only MAP yields can add field codes the inventory does not already know statically.
- Carry `cleardownFieldCodes` through verbatim.
  They are authored patterns, matched against answer codes at request time, not codes to resolve here.

## Editing Notes

- To change which fields the inventory sees, start in `FieldInventoryAnalyzer.findFieldBlocksForStep()`.
- To change which iterates the inventory sees, start in `FieldInventoryAnalyzer.findMapIterateNodesForStep()`.
- To add more cleardown inputs, update `AnswerCleardownInputs` in `contracts/plans/compilationPlan.type.ts`, then update `AnswerCleardownInputAnalyzer`.

## Entry Points

- [AnswerCleardownInputAnalyzer.ts](AnswerCleardownInputAnalyzer.ts) builds the journey's field inventory sources.
- [FieldInventoryAnalyzer.ts](../../../compilation/dependency-analysis/shared/FieldInventoryAnalyzer.ts) owns the shared field and map-iterate lookup.
