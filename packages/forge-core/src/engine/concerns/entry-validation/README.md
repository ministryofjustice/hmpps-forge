# entry-validation

Entry validation selects which validation groups apply when a step is entered (GET) and projects the
already-computed step validity onto the request view - it computes no validation itself. That split is the whole
point of the concern: `request.validities` has already run every validating step in non-submission mode, so all
this phase does is decide what the user should see on first render.

## Stage folders

- `lowering` holds `EntryValidationCompiler.ts`, which compiles the step's `validateOnEntry` rules into the group selector the phase handler runs.
- `runtime` holds `RequestEntryValidationWorkHandler.ts`, the phase handler.

There is no analysis folder: entry validation reads `validateOnEntry` straight off the step node, so it needs no
dependency-analysis pass of its own. `CompiledEntryValidationFunction` stays in the shared
[`../../contracts/compiled/compiledFunctions.type.ts`](../../contracts/compiled/compiledFunctions.type.ts)
alongside every other compiled-function type.

## Runtime phase

This concern owns `request.entry-validation`, which runs on step `GET` only. It creates no child work tasks.

## Cross-concern edges

- Entry validation imports **validation** for the validity store read API.
- No concern imports entry validation.

Every other concern edge is blocked by the zones in [eslint.config.mjs](../../../../eslint.config.mjs).
