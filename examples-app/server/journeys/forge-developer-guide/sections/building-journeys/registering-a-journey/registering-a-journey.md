---
title: Registering a journey
section: building-journeys
path: building-journeys/registering-a-journey
teaches: [createForgePackage, ForgePackage, registerPackage, package-components, package-functions, package-dependencies]
prerequisites: [journey, JourneyDefinition]
---

<p class="govuk-caption-xl">Building flows and content</p>

# Registering a journey

A package is what connects your journey definition to the runtime.
It bundles the journey with any custom components and effect
function implementations, and is what you register with Forge at
startup.

{{slot:toc}}

---

## What is a package?

Journey definitions are just data. They describe structure, not
behaviour. A package is the bridge between that data and the code
that makes it work: the component renderers, the effect function
implementations, and the external dependencies they need.

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'

export default createForgePackage({
  journey: travelDeclaration,
})
```

At its simplest, a package is just a wrapper around a journey. But
as your journey grows to include custom components and effect
functions, the package is where you bring them together.

Because journey definitions are plain objects with no functions or
runtime logic, they are fully serialisable. A package could load
its journey definition from a database, a file, or an API response
rather than importing it from a TypeScript module.

Additionally, packages offer the ability to register components and effects
alongside journey definitions. This is purely for convenience: it
lets you keep everything a journey needs in one place. A package could itself be
published as a standalone module with its journey, components, and effect
implementations all bundled together, to create reusable flows with integrations.

---

## Adding custom components

Components declared with `component()` or a renderer-specific helper such as
`nunjucksComponent()` register themselves when the journey builds a block
with them. That includes the GOV.UK and MOJ libraries and your own custom
components. An explicit `functions` listing is only needed when the journey
refers to a variant by string alone (a JSON journey, for example):

```typescript
export default createForgePackage({
  journey: travelDeclaration,
  functions: [myCustomCard, myStatusBadge],
})
```

Either way, components registered through a package are scoped to
that journey.

---

## Adding custom function implementations

Forge allows authors to write custom effects, conditions,
transformers, and generators. You register each on a registry
(`EffectRegistry`, `ConditionRegistry`, `TransformerRegistry`, or
`GeneratorRegistry`) and pass those registries to the package. The
`functions` property takes a single registry, or an array when a
journey uses several:

```typescript
export default createForgePackage<MyDeps>({
  journey: travelDeclaration,
  functions: [myEffects, myConditions, myTransformers],
})
```

Like components, functions registered through a package are scoped
to that journey. Functions declared as standalone entries with
`condition()`, `transformer()`, `generator()`, or `effect()` need no
listing at all - using one in the journey registers it.

---

## Registering a package

The package is what you pass to `forge.registerPackage()` at
startup. This is where Forge discovers your journey, compiles it,
and mounts its routes:

```typescript
import travelPackage from './journeys/travel-declaration'

forge.registerPackage(travelPackage)
```

### Injecting dependencies

If your custom functions need external services, pass them as the
second argument:

```typescript
forge.registerPackage(travelPackage, {
  myApi: services.myApi,
  dataStore: services.dataStore,
})
```

Forge injects these dependencies into all custom functions
(effects, conditions, transformers, and generators) at runtime.
This keeps your journey definitions and function implementations
free of direct service references, and makes testing
straightforward.

### Conditionally disabling a package

The `enabled` property controls whether a package is registered at
all. When set to `false`, `registerPackage()` skips it entirely:

```typescript
export default createForgePackage({
  enabled: config.featureFlags.travelDeclarationEnabled,
  journey: travelDeclaration,
  functions: myEffects,
})
```

This is useful for feature flags or environment-specific journeys.
The package still exists in your code, but Forge ignores it at
startup.

---

## Startup validation

When you register a package, Forge validates it before mounting any
routes. Problems are caught at startup rather than when a user
happens to visit the page. Forge checks for:

- **Serialisation**: journey definitions must be plain, serialisable
  objects. Functions, class instances, circular references, and
  undefined values are rejected.
- **Schema**: required properties like `path`, `title`, and `code`
  must be present and correctly typed. Hooks, blocks, and
  expressions are all checked against the expected structure.
- **Function references**: every condition, effect, transformer, and
  generator referenced in the journey must be registered. A missing
  implementation is flagged immediately.
- **Component variants**: every block variant must have a registered
  component. An unregistered variant fails validation.
- **Duplicate routes**: if two steps would produce the same URL,
  Forge raises a `DuplicateRouteError`.

If any check fails, Forge throws an error with the path to the
problem in the journey definition. When multiple issues exist, they
are collected and reported together so you can fix them in one pass.

---

## Best practices

- **Co-locate what belongs together.** Components and functions
  belong to the packages whose journeys use them - sharing across
  journeys just means using the same handles in each.
- **Keep the package file thin.** It should import and assemble,
  not contain logic. Journey definitions live in `journey.ts`,
  function implementations in their own files.
- **Let startup validation catch mistakes early.** If your
  application fails to start, read the error paths. Forge tells
  you exactly where in the definition the problem is.
