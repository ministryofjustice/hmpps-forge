# Components and renderers

## Purpose

Components build authored block invocations. A block carries a `variant`; the
request-owned function registry maps that variant to a component evaluator.

There is no separate component registry or component execution lifecycle. Component
entries use the same declaration, package collection, request binding, and lookup
model as conditions, transformers, generators, and effects.

## Declaring components

`component()` is the core declaration primitive. It returns a callable handle that is
both a block builder and a function entry:

```typescript
const MyCard = component<MyCardProps>('myCard', {
  factory: dependencies => ({ props, context }) => {
    return dependencies.templates.renderCard(props, context)
  },
})
```

Renderer-specific helpers such as `nunjucksComponent()` and `jsxComponent()` keep
their props-first authoring signatures, but they are only wrappers around
`component()`. Their results are ordinary component entries.

`renderer()` declares step composition separately. Its evaluator receives the
resolved step, route context, validation state, and ordered rendered children. A
journey supplies a default through `renderer`, and a step may replace it.

## Where this sits in the pipeline

1. Calling a component handle creates a basic or field block carrying its variant and
   an embedded entry stamp.
2. Package finalisation collects embedded entries and any entries explicitly listed
   in `functions`.
3. Semantic analysis checks that each block variant resolves to a component definition.
4. Compilation reads static component metadata without running its factory.
5. Request context preparation calls the factory once and stores the evaluator in
   the request's `FunctionRegistry`.
6. Render work resolves that request-bound entry and calls its evaluator with
   `{ props, context }`.

The variant remains the stable link between the declarative block and its executable
component function.

## Static and request-bound shapes

The unbound component definition carries the variant, factory, and any
field metadata. This is sufficient for validation and compilation.

The request-bound registry row adds `evaluate`, produced by applying the current
package, adapter, and request dependencies to the factory. Evaluators are therefore isolated
to a request while the declaration remains reusable across packages.

## Basic and field blocks

Basic blocks represent content and layout. Field blocks additionally participate in
answer capture and validation.

A field component declaration can expose static `inputSchema`, `multiple`, and
`errorAnchor` metadata. Its evaluator receives resolved `code`, `value`, and
`errors` in `props`. Forge can inspect the metadata without executing the factory.

## Framework rendering

Forge owns function lookup, component and renderer evaluation, and nested render
ordering. The framework adapter supplies any stable capabilities those factories
need, wraps nested output, and assembles the final page.

The Express/Nunjucks adapter supplies its environment through adapter dependencies.
`nunjucksComponent()` captures that dependency and preserves the existing
`(props, nunjucksEnv)` authoring callback. Forge core treats the dependency object
and presentation output as opaque values.

This keeps template-engine assumptions outside `forge-core` without inventing a
second registry contract.

## Nested blocks

Blocks can occur inside component props. Forge renders those children first and
asks the adapter to wrap each result. The parent receives those wrapped values in
its resolved props, so it never needs to call the rendering pipeline itself.

Nested and top-level blocks resolve through the same request `FunctionRegistry` and
execute the same component evaluator shape.

## Built-in and name-only entries

Using a component handle in a TypeScript journey registers it automatically. Serialized
or otherwise name-only journeys must list the entries explicitly:

```typescript
createForgePackage({
  journey: serializedJourney,
  functions: [...builtInComponents, MyCard],
})
```

The deprecated `components` package field accepts those same component entries and is
only a compatibility spelling for listing them.

## What can fail

Important failure cases include:

- duplicate function names within one package
- a block variant that does not resolve to a component definition
- a component used in `renderer`, or a renderer used in `blocks`
- a component or renderer factory or evaluator throwing
- a renderer-specific compatibility wrapper rejecting the evaluator's output
- unsupported nested render output

Missing and wrongly typed entries should fail during registration or semantic
analysis. Failures that depend on request data or templates remain runtime errors.

## Rules to preserve

- Components are function entries, not a parallel extension system.
- Variants resolve through the package-scoped definition catalog and request-owned
  function registry.
- Factories run during request preparation, not registration or compilation.
- Forge owns evaluation and ordering; adapters own concrete rendering.
- Renderer-specific component helpers may adapt authoring ergonomics but must return
  ordinary component entries.
