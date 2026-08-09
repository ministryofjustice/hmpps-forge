# Answer Preparation Inputs

## Scope

This document covers `packages/forge-core/src/engine/concerns/answer-preparation/analysis`.

This code builds the dependency-analysis inputs for the answer-preparation lowering phase.
It selects the field blocks and map iterates that can produce or normalize answers for a step or journey.

This document does not cover answer preparation runtime behavior or generated code.

## Inputs Built

`AnswerPreparationInputAnalyzer.buildInputs()` returns `AnswerPreparationInputs` for one step:
- `fieldBlocks`, all field blocks that descend from the step.
- `mapIterateNodes`, all `IteratorType.MAP` iterate nodes that descend from the step.

`AnswerPreparationInputAnalyzer.buildJourneyInputs()` returns the journey-level field inventory:
- `stepFieldBlocks`, all field blocks from the steps in the journey's reachability state table.
- `stepMapIterateNodes`, all map iterate nodes from those same steps.

Both methods delegate field and iterate lookup to `FieldInventoryAnalyzer`.

## Rules

- Use descendant checks from `FieldInventoryAnalyzer`.
  Source paths are diagnostics, not ownership data.
- Include only map iterates.
  Answer preparation cares about produced answer shapes, not every iterator kind.
- Build journey inputs from the step IDs in the reachability state table.
  That keeps the journey inventory aligned with the steps navigation can visit.

## Editing Notes

- To change which fields answer preparation sees, start in `FieldInventoryAnalyzer.findFieldBlocksForStep()`.
- To change which iterates answer preparation sees, start in `FieldInventoryAnalyzer.findMapIterateNodesForStep()`.
- To add more answer-preparation inputs, update `AnswerPreparationInputs` in `contracts/plans/compilationPlan.type.ts`, then update `AnswerPreparationInputAnalyzer`.

## Entry Points

- [AnswerPreparationInputAnalyzer.ts](AnswerPreparationInputAnalyzer.ts) builds step and journey inputs for answer preparation.
- [FieldInventoryAnalyzer.ts](../../../compilation/dependency-analysis/shared/FieldInventoryAnalyzer.ts) owns the shared field and map-iterate lookup.
