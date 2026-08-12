# Validation Compiler

## Scope

This document covers `packages/forge-core/src/engine/concerns/validation/lowering`.

This code compiles submit validation.
It emits validation functions that return validation `WorkTask`s.

This document does not cover semantic validation, runtime validation handler execution, or entry-validation
group selection - that lives in
[../../entry-validation/lowering/EntryValidationCompiler.ts](../../entry-validation/lowering/EntryValidationCompiler.ts).

## Inputs

`StepValidationCompiler.compileOnSubmitValidation()` receives:
- the step node.
- field blocks with configured validation.
- step-level `validWhen` values.
- map iterate nodes that may yield validating fields.

## Work Returned

Submit validation returns:
- `ctx.workTasks.stepValidation(fieldValidations, domainValidations)`.

Each field validation is built as:
- `ctx.workTasks.fieldValidation(key, props)`.

Each domain validation is built as:
- `ctx.workTasks.domainValidation(key, props)`.

## Rules

- Field validation and domain validation are separate task lists.
- `submissionOnly` validations are skipped when `isSubmission` is false.
- Validation groups default to `default` when omitted.
- A `TypeError` from a validation condition is treated as a validation failure.
  Other runtime errors still throw.
- Iterator validation emits loops over map iterator templates.
  Runtime validation does not instantiate AST nodes for iterator rows.
- Template field validation uses `ScopedTemplateCompiler.compileTemplateInstanceIdExpression()` for `blockId`.
  `blockCode` stays as field metadata and answer identity.
- Resolve must use the same template instance ID expression.
  If these drift, validation failures will not attach to the rendered field.

## Editing Notes

- To change submit validation shape, start in `buildSubmitValidationSource()`.
- To change field validation tasks, start in `compileFieldValidationSlot()`.
- To change domain validation tasks, start in `compileDomainValidationSlot()`.
- To change iterator validation, start in `compileIterateBlock()` and `compileTemplateValidations()`.
- To change template field identity, update `ScopedTemplateCompiler` and check resolve at the same time.
- To inspect generated source, use `generateOnSubmitValidationSource()` in the tests.

## Entry Points

- [StepValidationCompiler.ts](StepValidationCompiler.ts) emits submit-validation source.
