# validation

Validation decides whether a step's answers pass the rules the author wrote. It records the full failure set for a
step - every field failure and every domain failure, with its groups and its `submissionOnly` flag intact - and
then projects that stored result for each reader. Reachability asks for non-submission default-group validity,
submit hooks ask for submission-mode validity with their own groups, and render asks for the failures it should
show. Filtering at write time would throw away failures another reader still needs, so filtering happens on read.

## Stage folders

- [analysis](analysis/README.md) selects the validating field blocks and map iterates for a step, and answers whether a step validates at all.
- [lowering](lowering/README.md) emits submit validation. Entry-validation group selection is compiled by [entry-validation](../entry-validation/lowering/EntryValidationCompiler.ts).
- [runtime](runtime/README.md) runs the compiled tasks, stores `StepValidityResult` by `NodeId`, and filters it into a `ValidationView`.
- `contracts` holds `ValidationWork.type.ts`, `stepValidityResult.type.ts`, `validationResult.type.ts`, and `validationView.type.ts`.

## Runtime phases

This concern owns `request.validities`, the eager cross-step pass that populates step validities before
reachability reads them. It also owns the `submit.validation` work stage, which runs inside
[hooks](../hooks/README.md)' `request.submit` lifecycle rather than as a phase of its own. The child work kinds
are `validation.step`, `validation.field`, and `validation.domain`.

## Cross-concern edges

- Validation imports **hooks** because `SubmitValidationWorkHandler` runs as a hook stage and uses the hook work-stage contracts.
- **entry-validation**, **hooks**, **reachability**, and **resolve** all import validation to read stored step validity.

Validation is the most imported concern in the engine, which is why its read API - `stepValidity()`,
`stepValidityState.ts`, and the validity result types - is kept small and free of request-phase knowledge. The
zones are in [eslint.config.mjs](../../../../eslint.config.mjs).
