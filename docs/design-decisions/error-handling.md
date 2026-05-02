# Error handling

## Purpose

Forge errors should explain which part of the journey failed and when it
failed.

The main aim is diagnostic clarity. Errors should carry enough context to point
back to the authored definition, the compilation phase, the node being
evaluated, or the registered function or component that could not be resolved.

## Where errors can happen

The engine has several phases with different failure modes:

1. Registration prepares functions, components, and journey packages. A bad
   definition or invalid extension registration should fail here.

2. Validation checks that the journey definition is serialisable, structurally
   valid, and semantically valid.

3. Compilation builds runtime plans and generated functions. A generated
   function that cannot be compiled should fail here.

4. Runtime evaluates a request using the compiled plans and current context. A
   registered function that throws during request handling should fail here.

Each point should fail as early as possible.

If a problem is knowable before routes are mounted, it should not be deferred
to runtime.

## Error groups

Forge does not have one base error class for every failure.

Instead, errors are grouped by the boundary where they occur.

### Configuration errors

Configuration errors describe problems in the journey definition.

These include:

- serialisation errors, where object definitions cannot be represented as JSON
- schema errors, where the definition shape does not match the DSL schema
- reference-scope errors, where a scoped reference is used in the wrong place
- unregistered function errors
- unregistered component errors

These errors are raised before compilation. They should include DSL path
information so the failure can be traced back to the authored definition.

### Registry errors

Registry errors describe invalid extension registration.

These include:

- duplicate function names
- duplicate component variants
- malformed function entries
- malformed component entries

Registry errors happen before a journey is compiled. They protect validation,
compilation, runtime evaluation, and rendering from missing or ambiguous
extension lookups.

### Compilation errors

Compilation errors describe failures while building generated functions.

`ForgeCompilationError` is used when generated source cannot be turned into an
executable function.

It records the compilation phase and, where available, node or function
metadata. This helps separate compiler failures from request-time evaluation
failures.

### Runtime evaluation errors

Runtime evaluation errors describe failures while a compiled function is being
executed for a request.

`ForgeRuntimeEvaluationError` is used when Forge needs to wrap a non-`Error`
failure from generated code. When generated code throws an existing `Error`,
Forge preserves that error and attaches non-enumerable runtime diagnostics to
it.

This keeps application errors recognisable while still adding Forge context.

### Route and node errors

Some errors protect internal invariants.

Examples include duplicate route paths, unknown node types, and invalid node
shapes.

These errors usually mean Forge could not build or mount a reliable internal
model from the definition and compiled structures.

## Diagnostic metadata

Forge errors can carry diagnostic fields as properties.

Common fields include:

- `phase`
- `path`
- `formattedPath`
- `nodeId`
- `code`
- `expected`
- `functionName`
- `functionType`
- `variant`
- `cause`

Not every error has every field. Each error should carry the fields that make
sense for its boundary.

For example, an unregistered function error should identify the function name,
function type, and DSL path. A compilation error should identify the phase and
cause, and include node or function metadata when available.

## DSL paths

DSL paths connect errors back to the authored definition.

Forge tracks both raw path data and formatted paths. Raw paths are structural
paths through the definition object. Formatted paths prefer journey codes, step
paths or titles, block variants, field codes, and function names where that
information is available.

Formatted paths are for humans. Raw paths are still useful when the formatted
path cannot be built or when tooling needs the exact object location.

Validation attaches these paths before Forge builds the intermediate
representation. Compilation then carries source metadata through AST nodes and
generated expressions so runtime diagnostics can still point back to the
definition.

## Diagnostic stacks

Forge custom errors format their stack from `toString()`.

This means diagnostic fields appear in logs that serialise `error.stack`,
rather than only in direct calls to `error.toString()`.

The rule is simple: if a custom error has useful diagnostic fields, its string
form should include them.

## Aggregate errors during registration

Validation and registry registration can find more than one problem at once.

When that happens, Forge uses `AggregateError` to keep all related failures
together.

During journey or package registration, Forge formats aggregate errors into a
numbered list. Each entry includes the error name, message, and any diagnostic
fields such as path, code, expected value, function name, function type, variant,
phase, node, or cause.

This keeps startup logs readable when a definition has several independent
problems.

`strictRegistration` controls whether registration errors are rethrown after
logging. When strict registration is off, Forge logs the error and continues.
When it is on, Forge rethrows the original error.

## Generated-function diagnostics

Generated functions need special handling because the failing code was produced
by Forge.

Compilation wraps generated source so runtime failures can be decorated with
the current Forge diagnostic state. Expression compilation updates that state
with the node ID, DSL path, formatted path, function name, and function type
where those values are known.

If generated code throws:

- existing `Error` objects are preserved and decorated with Forge diagnostics
- non-`Error` thrown values are wrapped in `ForgeRuntimeEvaluationError`
- promise rejections from async generated functions follow the same rules

This keeps generated-function failures connected to the authored definition
without hiding the original application error.

## What should fail early

The following problems should fail before routes are mounted:

- invalid JSON-compatible structure
- invalid DSL schema
- invalid reference scope
- unknown function names
- unknown component variants
- malformed function or component registry entries
- duplicate function names or component variants in one registry
- failures while compiling generated functions

These failures are configuration or compilation problems. They should not be
left for a user request to discover.

## What can fail at runtime

Some failures depend on request-time state and cannot be fully known during
registration.

Runtime failures include:

- registered functions throwing
- effects failing while talking to application services
- generated expressions receiving unexpected request data
- route handlers missing a required compiled function
- framework adapters failing to render, redirect, or write a response

Runtime errors should still carry diagnostics where Forge has enough metadata.

The main rule to preserve is that runtime failures should not lose the authored
context that produced the generated code.

## Rules to preserve

Configuration problems should fail before compilation.

Compilation problems should identify the phase that failed.

Runtime evaluation failures should preserve the original error when possible.

Errors from generated functions should carry Forge diagnostics.

`AggregateError` should be used when Forge can report several independent
registration or validation errors together.

Diagnostic fields should be structured properties first, and formatted text
second.

## Connection to other docs

The validation doc explains the configuration checks that run before IR
construction.

The compilation doc explains where generated functions are built and wrapped.

The request lifecycle doc explains how runtime errors surface while handling
GET, POST, and journey-root requests.

The extension model docs explain registry failures for functions and
components.
