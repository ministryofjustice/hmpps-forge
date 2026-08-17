# answer-preparation

Answer preparation turns whatever arrived on the request into the step's answer history. On `POST` it normalizes
submitted values, checks them against the component input schema, runs parsers and formatters, and records each
change as a mutation. On `GET` it keeps the existing answer or seeds the authored `defaultValue`. Every later
concern - validation, hooks, reachability, resolve - reads the answers this concern produced, which is why it
runs so early in the pipeline.

## Stage folders

- [analysis](analysis/README.md) selects the field blocks and map iterates that can produce answers for a step or journey.
- [lowering](lowering/README.md) emits the `CompiledAnswerPreparationFunction` that builds the field task list.
- [runtime](runtime/README.md) runs those tasks and folds the per-field summaries.
- `contracts` holds `AnswerPreparationWork.type.ts`, the work props and result types shared by lowering and runtime.

## Runtime phase

This concern owns `request.answer-preparation`, which runs the compiled `answer.preparation` task and its
`answer.preparation.field` children.

## Cross-concern edges

Answer preparation imports no other concern, and no other concern imports it. It reads and writes
`context.domain.answers` directly, so everything downstream picks the answers up from the runtime context rather
than from this concern's files. The zones that enforce that are in
[eslint.config.mjs](../../../../eslint.config.mjs).
