# Answer Cleardown Analysis

## Scope

This document covers `packages/forge-core/src/engine/concerns/answer-cleardown/analysis`.

This code builds the answer-cleardown concern's semantic model for the field-inventory lowering phase.
It carries, for every step a journey owns, the classified field occurrences that can produce answers and the step's authored cleardown patterns.

This document does not cover the cleardown algorithm or how the compiled inventory is evaluated at request time.

## Model Built

`AnswerCleardownAnalyzer.analyzeJourney()` returns `CleardownModel` for one journey:
- `steps`, one entry per owned step in document order, each carrying the step ID, its field models, and its `cleardownFieldCodes`.
- `label`, the journey-level script-URL identity segment.

## Rules

- Build one entry per owned step, in document order.
  The compiled inventory reports every step in the journey, reachable or not; document order matches the reachability state table's order.
- Read `cleardownFieldCodes` straight off the step node and carry them verbatim.
  They are authored patterns, matched against answer codes at request time, not codes to resolve here.
- No reachability dependency.
  The ordered step list and the cleardown patterns both come from the analysis context, so cleardown analysis needs nothing from the reachability model.

## Editing Notes

- To change how field occurrences are classified, start in `FieldModelBuilder`.
- To add cleardown model fields, update `CleardownModel` in `../contracts/cleardownModel.type.ts`, then update `AnswerCleardownAnalyzer`.

## Entry Points

- [AnswerCleardownAnalyzer.ts](AnswerCleardownAnalyzer.ts) builds the journey's cleardown model.
- [FieldModelBuilder.ts](../../../chassis/compilation/analysis/shared/FieldModelBuilder.ts) owns field-occurrence classification.
