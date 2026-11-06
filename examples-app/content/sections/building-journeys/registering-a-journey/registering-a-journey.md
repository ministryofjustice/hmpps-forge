---
title: Registering a journey
section: building-journeys
path: building-journeys/registering-a-journey
teaches: [ForgePackage, register_package, package-components, package-functions, package-dependencies]
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

```rust
use forge_core::ForgePackage;

pub fn travel_package() -> ForgePackage {
    ForgePackage::new(travel_declaration())
}
```

At its simplest, a package is just a wrapper around a journey. But
as your journey grows to include custom components and effect
functions, the package is where you bring them together.

Because journey definitions are plain objects with no functions or
runtime logic, they are fully serialisable. A package could load
its journey definition from a database, a file, or an API response
rather than building it in a Rust module.

Additionally, packages offer the ability to register components and effects
alongside journey definitions. This is purely for convenience: it
lets you keep everything a journey needs in one place. A package could itself be
published as a standalone module with its journey, components, and effect
implementations all bundled together, to create reusable flows with integrations.

---

## Adding custom components

If your journey uses components beyond the built-in GOV.UK and MOJ
libraries, register them in the package:

```rust
pub fn travel_package() -> ForgePackage {
    ForgePackage::new(travel_declaration())
        .with_components([my_custom_card(), my_status_badge()])
}
```

Components registered through a package are scoped to that journey.
To register components globally (available to all journeys), use
`forge.register_global_components()`.

---

## Adding custom function implementations

Forge allows authors to write custom effects, conditions,
transformers, and generators. You write each as a `FunctionEntry`
(`FunctionEntry::effect`, `FunctionEntry::condition`,
`FunctionEntry::transformer`, or `FunctionEntry::generator`) and pass
them to the package with `with_functions()`, which you can call as
many times as you need:

```rust
pub fn travel_package(services: Arc<Services>) -> ForgePackage {
    ForgePackage::new(travel_declaration())
        .with_functions(my_effects(services.clone()))
        .with_functions(my_conditions())
        .with_functions(my_transformers())
}
```

Like components, functions registered through a package are scoped
to that journey. To register functions globally, use
`forge.register_global_functions()`.

---

## Registering a package

The package is what you pass to `forge.register_package()` at
startup. This is where Forge discovers your journey, compiles it,
and mounts its routes:

```rust
use crate::journeys::travel_declaration::travel_package;

forge.register_package(travel_package(services.clone()))?;
```

### Injecting dependencies

If your custom functions need external services, pass them to the
function that builds the entries, and let each closure capture what
it needs:

```rust
pub fn my_effects(services: Arc<Services>) -> Vec<FunctionEntry> {
    let api = services.my_api.clone();
    vec![FunctionEntry::effect("SaveTravelDetails", move |context, _args| {
        let api = api.clone();
        async move {
            api.save(Value::object(context.get_all_answers())).await?;
            Ok(())
        }
    })]
}
```

The closures keep their services for the life of the application,
so every call of the function can use them. This keeps your journey
definitions free of service references, and makes testing
straightforward: build the package with stand-in services.

### Conditionally disabling a package

The `enabled` field controls whether a package is registered at
all. When set to `false`, `register_package()` skips it entirely:

```rust
pub fn travel_package(services: Arc<Services>, config: &Config) -> ForgePackage {
    ForgePackage {
        enabled: config.feature_flags.travel_declaration_enabled,
        ..ForgePackage::new(travel_declaration()).with_functions(my_effects(services))
    }
}
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
  values. Opaque values (such as dates) and undefined values are
  rejected.
- **Schema**: required properties like `path`, `title`, and `code`
  must be present and correctly typed. Hooks, blocks, and
  expressions are all checked against the expected structure.
- **Function references**: every condition, effect, transformer, and
  generator referenced in the journey must be registered. A missing
  implementation is flagged immediately.
- **Component variants**: every block variant must have a registered
  component. An unregistered variant fails validation.
- **Duplicate routes**: if two steps would produce the same URL,
  Forge returns a `ForgeError::DuplicateRoute`. A step whose path
  is the journey's own path is the exception: the step serves it.

If any check fails, `register_package()` returns an error with the path to the
problem in the journey definition. When multiple issues exist, they
are collected and reported together so you can fix them in one pass.

---

## Best practices

- **Co-locate what belongs together.** Register components and
  functions in the package when they are part of the same journey.
  Register them globally when they are shared across journeys.
- **Keep the package module thin.** It should import and assemble,
  not contain logic. Journey definitions live in `journey.rs`,
  function implementations in their own modules.
- **Let startup validation catch mistakes early.** If your
  application fails to start, read the error paths. Forge tells
  you exactly where in the definition the problem is.
