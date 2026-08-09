# entry-validation

Entry validation selects which validation groups apply when a step is entered (GET) and projects the
already-computed step validity onto the request view - it computes no validation itself. That split is the whole
point of the concern: `request.validities` has already run every validating step in non-submission mode, so all
this phase does is decide what the user should see on first render.

## Stage folders

- `runtime` holds `RequestEntryValidationWorkHandler.ts`, the phase handler.

There is no analysis or lowering folder yet. The lowering side - the `compileOnEntryValidation` family and
`CompiledEntryValidationFunction` - is still inside
[`../validation/lowering/StepValidationCompiler.ts`](../validation/lowering/StepValidationCompiler.ts) and moves
here when that class is split in round two.

## Runtime phase

This concern owns `request.entry-validation`, which runs on step `GET` only. It creates no child work tasks.

## Cross-concern edges

- Entry validation imports **validation** for the validity store read API.
- No concern imports entry validation.

Every other concern edge is blocked by the zones in [eslint.config.mjs](../../../../eslint.config.mjs).
