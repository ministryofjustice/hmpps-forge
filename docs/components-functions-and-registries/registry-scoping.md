# Registry scoping

## Purpose

Registry scoping controls which functions and components a journey can see.

Forge has global registries for functions and components. Package registration
can create scoped registries for one package. A scoped registry can use package
entries first, then fall back to the global registry.

This lets packages bring their own functions and components without mutating
the global extension environment for every other journey.

## Where this sits in the pipeline

Registry scoping is decided during registration.

The selected function and component registries are then used across the rest of
the journey lifecycle:

1. Validation checks function names and component variants against the active
   registries.

2. Compilation uses the active function registry for sync and async function
   metadata.

3. Runtime evaluation calls functions through the active function registry.

4. Framework rendering resolves component variants through the active component
   registry.

The important point is that validation, compilation, runtime, and rendering all
use the same scoped view of extensions for a journey.

## Global registries

A `Forge` instance owns one global function registry and one global component
registry.

Global functions and components are visible to every journey registered with
that `Forge` instance.

Built-in functions and built-in components are registered globally when Forge is
configured to include them. Application code can also register global functions
and components.

Global registration is useful for extensions that should be shared across all
journeys in the same runtime.

## Package-scoped registries

A package can include its own functions, components, and journey definition.

When package functions are present, Forge creates a `ScopedFunctionRegistry`.
The package functions are registered into that scoped registry.

When package components are present, Forge creates a `ScopedComponentRegistry`.
The package components are registered into that scoped registry.

The journey is then registered with those scoped registries as part of its
dependencies.

This gives the package a local extension environment for validation,
compilation, runtime evaluation, and rendering.

## Fallback lookup

Scoped registries use fallback lookup.

For functions, lookup checks the scoped function registry first. If the function
name is not found there, lookup falls back to the parent function registry.

For components, lookup checks the scoped component registry first. If the
variant is not found there, lookup falls back to the parent component registry.

This means package entries take precedence over global entries with the same
name or variant, while still inheriting the global registry.

The same precedence applies when all entries are read from a scoped registry.
Parent entries are read first, then scoped entries replace matching names or
variants.

## Isolation between packages

Scoped registration isolates package extensions from unrelated journeys.

If package A registers a custom function or component, package B should not see
it unless that extension is registered globally too.

This matters when different packages use the same local names. It also matters
when a package depends on services or renderers that should not be available to
other journeys.

Scoping keeps package-local extension decisions close to the package that needs
them.

## Component scoping and framework adapters

Component scoping affects framework rendering as well as validation.

When package components are registered, the package's `ScopedComponentRegistry`
is stored in the package's dependencies. During registration `MountRegistry`
copies it onto each route's `MountedNode` as `componentRegistry`, and render
time resolves component variants through that per-route registry.

Without this, validation could see a scoped component while rendering still
used the global component registry.

The framework adapter is constructed once and is never passed or rebuilt with a
component registry. Each route renders through the scoped component registry on
its `MountedNode`, derived from the package's dependencies, so there is no separate
adapter-held registry to reconcile.

## Function scoping and generated code

Function scoping affects both compilation and runtime evaluation.

Compilation reads function metadata from the active function registry. This is
how generated functions know whether a registered evaluator should be treated as
sync or async.

Runtime evaluation then receives the same active function registry through the
compiled evaluation context.

The function name that validates and compiles should resolve to the same
evaluator when the generated function runs.

## What can fail

Important failure cases include:

- a package function entry is malformed
- a package component entry is malformed
- a package registers duplicate names or variants inside its scoped registry
- a journey references a function not visible in its active function registry
- a journey references a variant not visible in its active component registry

Most of these should fail during registration or validation.

Runtime failures should be reserved for cases that depend on executing the
registered function or component renderer.

## Rules to preserve

Global extensions should be visible to all journeys registered with the same
`Forge` instance.

Package-scoped extensions should be visible to the package journey they are
registered with.

Package-scoped extensions should not become visible to unrelated journeys.

Scoped registries should prefer local entries, then fall back to global entries.

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
