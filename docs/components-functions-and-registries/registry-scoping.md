# Registry scoping

## Purpose

Registry scoping controls which functions and components a journey can see.

Every registered package owns its function definitions, builders, dependencies,
and component registry. Each request gets an isolated function registry. Forge
has no global extension registries and does not install built-ins automatically.

This lets packages bring their own functions and components without mutating
the extension environment for every other journey.

## Where this sits in the pipeline

Registry scoping is decided during registration.

The selected function and component registries are then used across the rest of
the journey lifecycle:

1. Validation checks function names and component variants against the active
   registries.

2. Compilation uses the package's unbound function metadata.

3. Context preparation builds the active request function registry.

4. Runtime evaluation calls functions through that request registry.

5. Framework rendering resolves component variants through the active component
   registry.

The important point is that validation, compilation, runtime, and rendering all
use the same package-scoped names, while executable function evaluators remain
request-owned.

## Built-in entries

Built-in functions and components are ordinary entries. A TypeScript journey
registers an entry automatically when it uses its authoring handle.

Serialized and other name-only journeys cannot carry those handles. They can
opt into the complete built-in sets explicitly:

```typescript
import { builtInFunctions, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { builtInComponents } from '@ministryofjustice/hmpps-forge/core/components'

createForgePackage({
  journey: serializedJourney,
  functions: [...builtInFunctions],
  components: [...builtInComponents],
})
```

Packages can instead list only the individual entries they reference.

## Package-scoped registries

A package can include its own functions, components, and journey definition.

Forge catalogs each package's unbound function definitions for compilation and
retains its builders and `packageDependencies` for request preparation.

Forge creates a `ComponentRegistry` for each package and registers the package's
components into it.

At the start of each request Forge builds a new `FunctionRegistry` from those
retained builders and dependencies.

This gives the package a local extension environment for validation,
compilation, runtime evaluation, and rendering.

## Isolation between packages

Scoped registration isolates package extensions from unrelated journeys.

If package A registers a custom function or component, package B should not see
it. Sharing an extension means each package registers it - the same handle used
in two journeys registers for both packages.

This matters when different packages use the same local names. It also matters
when a package depends on services or renderers that should not be available to
other journeys.

Scoping keeps package-local extension decisions close to the package that needs
them.

## Component scoping and framework adapters

Component scoping affects framework rendering as well as validation.

When package components are registered, the package's `ComponentRegistry`
is stored in the package's dependencies. During registration `MountRegistry`
copies it onto each route's `MountedNode` as `componentRegistry`, and render
time resolves component variants through that per-route registry.

The framework adapter is constructed once and is never passed or rebuilt with a
component registry. Each route renders through the package component registry on
its `MountedNode`, derived from the package's dependencies, so there is no separate
adapter-held registry to reconcile.

## Function scoping and generated code

Function scoping affects both compilation and runtime evaluation.

Compilation reads unbound function metadata from the package definition catalog.

Runtime evaluation receives the request-owned function registry through the
compiled evaluation context. Each returned value is inspected for thenability at
the generated call site.

The function name that validates and compiles should resolve to the same
evaluator when the generated function runs.

## What can fail

Important failure cases include:

- a package function entry is malformed
- a package component entry is malformed
- a package registers duplicate names or variants inside its registry
- a journey references a function not visible in its active function registry
- a journey references a variant not visible in its active component registry

Most of these should fail during registration or validation.

Runtime failures should be reserved for cases that depend on executing the
registered function or component renderer.

## Rules to preserve

Package-scoped extensions should be visible to the package journey they are
registered with.

Package-scoped extensions should not become visible to unrelated journeys.

Built-in entries should be registered through the same package surface as every
other extension.

Validation, compilation, runtime evaluation, and rendering should use the same
scoped view of functions and components for a journey.

## Connection to other docs

The extension model doc explains why functions, components, and registries form
Forge's extension surface.

The functions and function registry doc explains function entries and generated
function call sites.

The components and component registry doc explains component variants and
render-facing component contracts.

The framework adapter docs explain why component registry selection affects
rendering, through the per-route `MountedNode` rather than adapter construction.
