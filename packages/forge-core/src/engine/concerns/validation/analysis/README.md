# Validation Analysis

## Scope

This document covers `packages/forge-core/src/engine/concerns/validation/analysis`.

This code builds the validation concern's semantic model for lowering.
It selects the validating field occurrences, classifies the step's domain rules, and carries the entry-validation group selectors.

This document does not cover validation rule semantics, validation runtime execution, or generated code.

## Model Built

`ValidationAnalyzer.analyzeStep()` returns `ValidationModel` for one step:
- `hasValidation`, true when the step has validating registered fields or a step-level `validWhen`.
- `fields`, the field occurrences with configured validation, registered first, in document order.
- `domainRules`, the step's `validWhen` rules pre-classified as direct or dynamic; absent when none are configured.
- `entryValidation`, the step's `validateOnEntry` rules.
- `label`, the script-URL identity segment.

`hasValidation` owns the answer to "which steps does the eager validities phase validate".

## Rules

- A field counts as validating when its `validWhen` is configured.
  `undefined` and empty arrays are not configured; the shared classifiers in `contracts/models/validationRules.ts` own that definition.
- Template fields never count towards `hasValidation`.
  Only registered validating fields and a domain `validWhen` trigger eager validities.
- Do not repeat semantic placement checks here.
  `semantic-analysis` has already checked that validation expressions are legal.

## Editing Notes

- To change what counts as configured or direct rules, start in `contracts/models/validationRules.ts`.
- To change how field validation is classified, start in `FieldModelBuilder`.
- To add validation model fields, update `ValidationModel` in `../contracts/validationModel.type.ts`, then update `ValidationAnalyzer`.

## Entry Points

- [ValidationAnalyzer.ts](ValidationAnalyzer.ts) builds the validation model for one step.
- [FieldModelBuilder.ts](../../../chassis/compilation/analysis/shared/FieldModelBuilder.ts) owns field-occurrence classification, including rule pre-classification.
