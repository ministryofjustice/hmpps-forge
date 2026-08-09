# Validation Inputs

## Scope

This document covers `packages/forge-core/src/engine/compilation/dependency-analysis/validation`.

This code builds the dependency-analysis inputs for validation lowering.
It selects the step, field blocks with configured validation, and map iterates that validation compilation needs.

This document does not cover validation rule semantics, validation runtime execution, or generated code.

## Inputs Built

`ValidationInputAnalyzer.buildInputs()` returns `ValidationInputs` for one step:
- `stepNode`, the step being compiled.
- `hasValidation`, true when the step has validating field blocks or a step-level `validWhen`.
- `validatingFieldBlocks`, field blocks under the step with configured `validWhen`.
- `mapIterateNodes`, map iterate nodes under the step.

`hasValidation` owns the answer to "which steps does the eager validities phase validate".

Step-level `validWhen` stays on `stepNode`.
Field-level validation is filtered into `validatingFieldBlocks`.

## Rules

- A field block counts as validating when `validWhen` is configured.
  `undefined` and empty arrays are not configured.
- Include only map iterates.
  Validation needs map templates that can materialize repeated validation work.
- Do not repeat semantic placement checks here.
  `semantic-analysis` has already checked that validation expressions are legal.

## Editing Notes

- To change which field blocks get validation compiled, start in `FieldInventoryAnalyzer.findValidatingFieldBlocksForStep()`.
- To change what counts as configured validation, start in `FieldInventoryAnalyzer.hasConfiguredValue()`.
- To add validation inputs, update `ValidationInputs` in `contracts/plans/compilationPlan.type.ts`, then update `ValidationInputAnalyzer`.

## Entry Points

- [ValidationInputAnalyzer.ts](ValidationInputAnalyzer.ts) builds validation inputs for one step.
- [../shared/FieldInventoryAnalyzer.ts](../shared/FieldInventoryAnalyzer.ts) owns validating-field and map-iterate lookup.
