# entry-validation

Entry validation selects which validation groups apply when a step is entered (GET) and
projects the already-computed step validity onto the request view — it computes no validation
itself.

Its runtime handler lives here. Its lowering (the `compileOnEntryValidation` family and
`CompiledEntryValidationFunction`) is still inside
`../validation/lowering/StepValidationCompiler.ts` and moves here when that class is split.
