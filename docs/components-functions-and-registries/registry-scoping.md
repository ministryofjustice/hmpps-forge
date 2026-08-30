# Registry scoping

## Purpose

Registry scoping controls which function entries a journey can see. Render entries
use this same scope, so component variants require no parallel registry.

Every registered package owns its function builders and package dependencies. Each
request builds an isolated `FunctionRegistry`. Forge has no global extension
registry and does not install built-ins automatically.

## Lifecycle

1. Package finalisation collects embedded and explicitly listed function entries.
2. Registration builds a package-scoped `FunctionDefinitionCatalog` containing
   unbound metadata for all function kinds, including render.
3. Validation and compilation resolve names against that catalog.
4. Request preparation combines package, adapter, and request dependencies and asks each
   retained builder for its request-bound rows.
5. Conditions, transformers, generators, effects, and render work all resolve their
   evaluators from the resulting request `FunctionRegistry`.

The same package-scoped name therefore drives compilation and request execution,
while executable evaluators remain request-owned.

## Built-in entries

Built-ins are ordinary entries. TypeScript journeys collect an entry automatically
when they use its callable authoring handle. Name-only journeys list the entries
they need:

```typescript
import { builtInFunctions, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { builtInComponents } from '@ministryofjustice/hmpps-forge/core/components'

createForgePackage({
  journey: serializedJourney,
  functions: [...builtInFunctions, ...builtInComponents],
})
```

`builtInComponents` is a convenience collection of component entries; it is not a
different registry type.

## Package, adapter, and request dependencies

A package retains its long-lived `packageDependencies`. A framework adapter may
provide stable `adapterDependencies` and lazy `requestDependencies` for one request.
Forge rejects collisions between any two sources and builds a fresh merged dependency
object without mutating them.

Each function builder receives that merged object once per request. Render factories
therefore get the same dependency lifecycle as every other function factory.

## Isolation between packages

An entry registered for package A is invisible to package B unless package B also
registers it. Reusing the same declaration in two journeys registers it independently
for both packages.

This permits local names and local dependencies without mutating a process-wide
environment. A route's mounted state retains the package's function builders and
dependencies; it does not carry a component registry.

## What can fail

Important failure cases include:

- malformed or duplicate package entries
- dependency-name collisions between package, adapter, or request dependencies
- a referenced function name not visible to the active package
- a block variant not resolving to a render entry in that package
- a factory failing while the request registry is built

Name and shape failures should surface during registration or compilation. Factory
and evaluator failures remain request-time failures.

## Rules to preserve

- Every extension visible to a journey arrives through its package.
- Render entries follow the same package, adapter, and request scope as other functions.
- Compilation uses unbound metadata; runtime uses request-bound evaluators.
- Built-ins use the same registration surface as application entries.
- No adapter-held or route-held component registry should be reintroduced.
