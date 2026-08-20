# Answer Preparation Compiler

## Scope

This document covers `packages/forge-core/src/engine/concerns/answer-preparation/lowering`.

This code compiles answer preparation for steps and journeys.
It emits a `CompiledAnswerPreparationFunction` that builds answer-preparation `WorkTask`s.

This document does not cover validation, rendering, or answer preparation work-handler execution.

## Inputs

`StepAnswerPreparationCompiler.compile()` receives the `AnswerPreparationModel` analysis built:
- the classified field occurrences the step owns, including template fields under MAP iterators.

`CodegenOrchestrator` uses the same compiler for step answer preparation and journey answer preparation.
Journey calls pass the journey model, which aggregates the owned steps' fields in step order.

## Work Returned

The compiled function returns:
- `ctx.workTasks.answerPreparation(fieldPreparations)`.

Each field preparation is built as:
- `ctx.workTasks.fieldAnswerPreparation("field:" + code, props)`.

The generated function builds the task list.
The runtime work executor runs the answer-preparation handler and field handlers.

## Rules

- POST mode reads submitted values from `ctx.post`.
  It normalizes multiple fields, checks the component input schema, records a `post` mutation, runs formatters, and can record a `processed` mutation.
- The component input schema check runs between normalization and the `post` mutation.
  Variants that declare an `inputSchema` on their registry entry validate the normalized value; a value that fails the schema is dropped to absent (`undefined`, or `[]` when multiple).
  An unanswered value and variants without a schema are left untouched.
- GET mode does not run formatters.
  It keeps the current answer or seeds `defaultValue` when no answer exists.
- Parser output is display-only.
  It can set parsed state without replacing the current answer value.
- `dependentWhen` can clear a prepared value.
  It runs after formatter processing on POST.
- Iterator template fields are compiled inline.
  The runtime does not instantiate AST nodes to prepare iterator answers.

## Editing Notes

- To change POST behavior, start in `preparePostedFieldAnswerGroup()` in [generatedFunctionRuntimeLibrary.ts](../../../chassis/compilation/lowering/generatedFunctionRuntimeLibrary.ts).
- To change GET/default behavior, start in `prepareStoredFieldAnswerGroup()` in the same runtime library.
- To change formatter sequencing, start in `runPostedFieldPipeline()` there.
- To change iterator field preparation, start in `FieldModelBuilder` for classification and `compileFieldDefinitionEntry()` for the emitted entries.
- To inspect generated source, use `generateSource()` in the tests.

## Entry Points

- [StepAnswerPreparationCompiler.ts](StepAnswerPreparationCompiler.ts) emits answer-preparation source and compiles it.
