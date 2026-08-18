# Answer Preparation Analysis

## Scope

This document covers `packages/forge-core/src/engine/concerns/answer-preparation/analysis`.

This code builds the answer-preparation concern's semantic model for lowering.
It projects the field occurrences the shared field walk has already classified into one `AnswerPreparationModel` per step, and one per journey aggregating the owned steps.

This document does not cover answer preparation runtime behavior or generated code.

## Model Built

`AnswerPreparationAnalyzer.analyzeStep()` returns `AnswerPreparationModel` for one step:
- `fields`, every classified field occurrence the step owns — registered fields first, then template occurrences under MAP iterators, in document order.
- `label`, the script-URL identity segment.

`AnswerPreparationAnalyzer.analyzeJourney()` returns the journey-level model:
- `fields`, the owned steps' field models concatenated in step order.
- `label`, derived from the first field-carrying node so journey script URLs stay stable.

Field classification itself happens once in `FieldModelBuilder`; this analyzer only projects and labels.

## Rules

- The analyzer is zero-collaborator.
  Everything arrives in the analysis context: ownership, field models, the labeller.
- The journey model is a projection, not a re-query.
  It concatenates `context.stepFields` in step order.

## Editing Notes

- To change how field occurrences are classified, start in `FieldModelBuilder`.
- To add answer-preparation model fields, update `AnswerPreparationModel` in `../contracts/answerPreparationModel.type.ts`, then update `AnswerPreparationAnalyzer`.

## Entry Points

- [AnswerPreparationAnalyzer.ts](AnswerPreparationAnalyzer.ts) builds the step and journey models.
- [FieldModelBuilder.ts](../../../chassis/compilation/analysis/shared/FieldModelBuilder.ts) owns field-occurrence classification.
