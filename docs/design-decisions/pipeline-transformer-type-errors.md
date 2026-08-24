# Design decisions

## Pipeline and transformer TypeErrors

### Decision

Pipeline transformers should treat `undefined` and `null` as absent values and
skip the transformer call.

Transformer `TypeError`s should usually be treated as runtime errors.

There is one deliberate exception:

- answer preparation formatters keep the submitted value and stop the formatter
  chain when a formatter throws a `TypeError`

### Context

Pipelines are used to pass a value through one or more transformer functions.

Each transformer receives the previous value as its first argument. This makes
transformers composable: one step produces a value, and the next step receives
that value.

Many transformers have a clear input type. A string transformer expects a
string. A number transformer expects a number. A date transformer expects a
date. When the input has the wrong shape, transformers commonly throw a
`TypeError`.

That error can mean different things depending on where the pipeline is being
evaluated.

### Pipeline absent values

A pipeline does not call a transformer when the current piped value is
`undefined` or `null`.

An absent value means there is no value to transform. This can happen when a
reference does not resolve, a previous expression has no result, or a value is
intentionally absent.

Skipping the transformer keeps absence as absence. It avoids turning "there is
no value" into "the value had the wrong type".

This only applies to `undefined` and `null`. If a value exists but has the
wrong type, the transformer is still called and can throw.

### Validation conditions

Validation uses conditions to decide whether a validation rule passed.

An error thrown by a validation condition is a runtime error, the same as a
condition evaluated anywhere else.

A condition that encodes a type expectation should declare an `inputSchema`.
A value that fails the schema makes the condition return `false`, so the
authored validation message is shown without the evaluator running.

### Answer preparation formatters

Answer preparation is different from general expression evaluation.

On POST, Forge reads the submitted value, normalises it, stores the raw
submission, then runs formatter functions.

If a formatter throws a `TypeError`, Forge keeps the original submitted value
and stops running the remaining formatters for that field.

This allows validation to report the problem using normal field validation. It
also avoids replacing an invalid submission with a partially transformed value.

For example, a formatter that parses a number may throw because the submitted
value cannot be parsed as a number. In answer preparation, that should not hide
the original answer or crash the request before validation can run.

Non-`TypeError` failures are still thrown. Those are treated as runtime
failures because they are less likely to represent normal invalid input.

### Other evaluation contexts

Outside answer preparation formatters, transformer `TypeError`s are runtime
errors.

This includes pipelines used while rendering, generating values, evaluating
hooks, or computing navigation-related expressions.

In those contexts, a type mismatch usually means the journey definition,
registered function, or loaded request data is inconsistent with the expression
being evaluated. Failing loudly gives Forge diagnostics a chance to point at
the authored expression or registered function.

### Why the behaviour differs

The behaviour differs because the phases have different jobs.

Validation decides whether a value is acceptable. A type mismatch can be a
normal validation failure, but the sanctioned way to express that is a
condition `inputSchema`, not a thrown error.

Answer preparation preserves and records submitted answers. A formatter type
mismatch should leave the original submitted value available for validation.

Other phases make decisions from values that should already be suitable for the
expression being evaluated. A transformer `TypeError` in those phases is more
likely to be an implementation or configuration problem.

### Consequences

This keeps validation user-facing while keeping other phases diagnostic.

It also means formatter behaviour in answer preparation is intentionally not
the same as pipeline behaviour everywhere else.

Developers changing transformer or pipeline evaluation should check which phase
they are working in before changing error handling.

The main rule is:

- absence (`undefined` or `null`) should stay absent
- validation type mismatches should become validation failures via `inputSchema`
- answer-preparation formatter type mismatches should preserve submitted input
- unexpected type mismatches elsewhere should fail with diagnostics
