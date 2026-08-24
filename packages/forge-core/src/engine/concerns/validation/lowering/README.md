# Validation Compiler

## Scope

This document covers `packages/forge-core/src/engine/concerns/validation/lowering`.

This code compiles step validation and the `validateOnEntry` group selector.
It emits validation functions that return validation `WorkTask`s.

This document does not cover semantic validation or runtime validation handler execution.

## Inputs

`StepValidationCompiler.compileStepValidation()` receives the step's `ValidationModel`:
- the validating field occurrences, carrying their iterator scope.
- the step-level `validWhen` rules.

`EntryValidationCompiler.compileOnEntryValidation()` receives the same `ValidationModel` and, from its `validateOnEntry` entries, emits
the group selector the entry-validation phase runs: it evaluates each entry's `when` predicate and returns the
combined unique groups from every matching entry.

## Work Returned

Step validation returns:
- `ctx.workTasks.stepValidation(fieldValidations, domainValidations)`.

Each field validation is built as:
- `ctx.workTasks.fieldValidation(key, props)`.

Each domain validation is built as:
- `ctx.workTasks.domainValidation(key, props)`.

## Rules

- The generated function takes `(ctx, filter)` where `filter` is a `ValidationRuleFilter`.
  One function serves both validation rounds; the caller's filter selects what runs.
- Field validation and domain validation are separate task lists sharing the same filter semantics.
- Rule filtering happens before rule conditions are evaluated: a rule outside `filter.groups` never runs, and a
  `submissionOnly` rule only runs when `filter.includeSubmissionOnly` is true.
- Rule groups and filter groups default to `default` when omitted or empty.
- An error thrown by a validation condition propagates as a runtime error.
  Use `inputSchema` on the condition to fail softly on a wrongly-shaped value.
- Iterator validation emits loops over map iterator templates.
  Runtime validation does not instantiate AST nodes for iterator rows.
- Template field validation uses `ScopedTemplateCompiler.compileTemplateInstanceIdExpression()` for `blockId`.
  `blockCode` stays as field metadata and answer identity.
- Resolve must use the same template instance ID expression.
  If these drift, validation failures will not attach to the rendered field.

## Editing Notes

- To change step validation shape, start in `buildStepValidationSource()`.
- To change rule filtering, start in `compileRuleFilterSetup()`.
- To change field validation tasks, start in `compileFieldValidationSlot()`.
- To change domain validation tasks, start in `compileDomainValidationSlot()`.
- To change iterator validation, start in `compileTemplateField()` and `ScopedTemplateCompiler.compileFieldOccurrences()`.
- To change template field identity, update `ScopedTemplateCompiler` and check resolve at the same time.
- To inspect generated source, use `generateStepValidationSource()` in the tests.
- To change entry group selection, start in `EntryValidationCompiler.buildEntryValidationSource()`.

## Entry Points

- [StepValidationCompiler.ts](StepValidationCompiler.ts) emits step-validation source.
- [EntryValidationCompiler.ts](EntryValidationCompiler.ts) emits the `validateOnEntry` group selector.
