# Answer Preparation Compiler

## Scope

This document covers `packages/forge-core/src/engine/concerns/answer-preparation/lowering`.

This code compiles answer preparation for steps and journeys.
It emits a `CompiledAnswerPreparationFunction` that builds answer-preparation `WorkTask`s.

This document does not cover validation, rendering, or answer preparation work-handler execution.

## Inputs

`StepAnswerPreparationCompiler.compile()` receives:
- field blocks selected by dependency analysis.
- map iterate nodes whose yield templates may contain field blocks.

`CodegenOrchestrator` uses the same compiler for step answer preparation and journey answer preparation.
Journey calls pass the fields and map iterates from all steps in that journey's reachability state table.

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

- To change POST behavior, start in `StepAnswerPreparationCompiler.compilePostPath()`.
- To change GET/default behavior, start in `StepAnswerPreparationCompiler.compileGetPath()`.
- To change formatter sequencing, start in `compileFormatterPipeline()`.
- To change iterator field preparation, start around `compileIterateBlock()` and `compileTemplateAnswerPreparation()`.
- To inspect generated source, use `generateSource()` in the tests.

## Entry Points

- [StepAnswerPreparationCompiler.ts](StepAnswerPreparationCompiler.ts) emits answer-preparation source and compiles it.
