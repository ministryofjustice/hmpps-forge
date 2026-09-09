---
title: What Forge checks before your app starts
slug: what-forge-checks-before-your-app-starts
section: concepts
path: concepts/what-forge-checks-before-your-app-starts
nav: Inside the engine
order: 24
description:
  What Forge validates when a package is registered, and why problems surface at startup
  rather than at request time
teaches:
  [
    fail-fast,
    registration-validation,
    dsl-validation,
    semantic-analysis,
    diagnostic-metadata,
  ]
prerequisites: [packaging-journeys-into-an-app]
related:
  concept:
    [
      how-forge-compiles-definitions-and-why,
      packaging-journeys-into-an-app,
      how-expressions-work,
    ]
---

# What Forge checks before your app starts

When the application registers a package, Forge checks the definition immediately. If it
finds a problem, it reports the error and stops registration. The problem appears at
startup, before any user reaches the affected page.

## Why early checking matters

A missing component variant discovered at registration is a startup error with a clear
diagnostic message. The same problem discovered at request time is a user-facing failure,
visible only when someone reaches the specific page that uses that variant.

Forge moves that discovery to registration. Every function, component, scope rule, and
structural constraint is checked before routes are mounted. A problem that is knowable
before requests start is never deferred to request handling.

## What gets checked

Registration checks fall into four groups. Each group catches a different kind of problem.

### The definition is valid data

DSL validation checks that the definition is JSON-serialisable. It rejects JavaScript
functions, class instances, symbols, `undefined`, and non-plain objects. The definition
passes through `JSON.stringify` and `JSON.parse` to confirm round-trip fidelity.

This check prevents executable code from entering the compilation pipeline. Expressions in
a definition are tagged data nodes, not functions.

After the serialisability check, Zod schemas validate the structural shape.

### Everything appears where it is allowed

Semantic analysis checks that every part of the definition sits in a valid scope.

These rules catch problems that schema validation cannot express:

- `Item()` references must appear inside an `Iterator` at the correct depth.
- `Answer()` references must not appear inside access hooks, because the answer state does
  not exist during the access phase.
- `Self()` references must appear inside a field block.
- Effect functions must appear only inside hooks.
- Validation expressions must appear only under `validWhen`.
- Field codes must be unique within a step, unless the field uses `dependentWhen`.

Each rule reflects a guarantee that later stages depend on. An `Answer()` reference inside
an access hook is a definition error, not a runtime surprise.

### Functions and components exist

Semantic analysis checks that every referenced function name exists in the function
registry and that every referenced component variant exists there too.

When a function declares an argument schema, registration checks that the number of
arguments matches its arity. The schema checks argument values when the function runs,
after expressions resolve against request state.

These checks are why a misspelled function name appears at startup rather than when the
expression runs during a request.

### Routes do not conflict

Route analysis runs after compilation. It builds the step and journey route indexes and
detects conflicting mounted paths.

When two steps resolve to the same path, the routes conflict. Forge reports the conflict at
registration rather than when a request matches ambiguously at runtime.

## How errors are reported

Semantic analysis collects every problem it finds rather than stopping at the first one.
When a definition has several errors, Forge reports them together.

Each error carries diagnostic metadata:

- the DSL path (which part of the definition the error comes from)
- the node ID (the internal tree node)
- the expected value or constraint
- the function name or component variant, when relevant

That metadata traces the error back to the authored definition. A missing function error
names the function and the place in the definition that references it.

:::deep-dive
---
title: Why errors are aggregated
description: Collecting every error before stopping lets one registration attempt surface the full set of problems.
summary: Show the aggregation model
---

Semantic rules return error arrays rather than throwing. After all rules run, the errors
combine into one report.

This matters during development. If a definition has a missing function, an effect in the
wrong scope, and a duplicate field code, one registration attempt surfaces all three.
Without aggregation, each fix reveals only the next error. Three problems take three
registration attempts to find.

Later pipeline stages (analysis and lowering) do not aggregate errors. They assume that
semantic analysis already passed. If a later stage encounters a state that the semantic
rules forbid, it throws a `ForgeInternalError`, because the situation is a pipeline bug.
:::

## What can only fail at runtime

Not every problem is knowable at registration.

Registration checks the definition, the registries, and the route structure. It cannot
check what happens when a registered function evaluator runs with request-time data.

Runtime failures include:

- a function evaluator throws when called with specific request state
- an effect fails because an external service is unavailable
- a component renderer throws while producing output
- an iterator budget is exceeded by request-time collection data

These failures depend on request state, external services, or data that does not exist at
registration time. They are genuine runtime errors.

The boundary is clear. If a problem depends only on the definition and the registries,
Forge catches it at registration. If a problem depends on request-time state, it can only
fail at runtime.
