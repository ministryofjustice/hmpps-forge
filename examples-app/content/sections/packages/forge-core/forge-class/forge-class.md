---
title: Initialisation
section: packages
path: packages/forge-core/forge-class
teaches: [Forge, ForgeOptions, ForgePackage, register_package, register_global_components, register_global_functions]
prerequisites: [forge-core]
---

<p class="govuk-caption-xl">Forge Core</p>

# Initialisation
The `Forge` struct is the main entry point for setting up the
engine. It manages journey registration and the component and
function registries, and is what the Topcoat adapter mounts on your
web application.

{{slot:toc}}

---

## Creating an instance

```rust
use forge_core::{Forge, ForgeOptions};

let mut forge = Forge::new(ForgeOptions::default());
```

### Options

`ForgeOptions` is a struct; set the fields you need and take the
rest from `ForgeOptions::default()`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `base_path` | `String` | `""` | Base path prefix for all routes. When set, all routes are mounted under this path and the route tree includes the prefix. |
| `disable_built_in_functions` | `bool` | `false` | Skip registering built-in conditions, transformers, and generators. |
| `disable_built_in_components` | `bool` | `false` | Skip registering built-in components (`html`, `collectionBlock`, `templateWrapper`). |
| `max_iterator_iterations` | `usize` | `10000` | The most items iterators may process in one request. |
| `instrumentation` | `Instrumentation` | none | Trace sinks for request and compilation diagnostics (for example the `forge-devtools` bridge). |

Registration errors are always returned: `register_package()` and the
other registration methods return a `ForgeResult`, and Forge logs
nothing itself.

---

## Registering packages

### register_package()

Register a self-contained package that bundles a journey with
its custom functions and components:

```rust
forge.register_package(my_package(services.clone()))?;
```

Services the package's functions need are passed to the function
that builds the package. When a package includes custom functions or
components, Forge creates scoped registries so they are available to
that journey without polluting the global registries.

Packages can be conditionally disabled:

```rust
forge.register_package(ForgePackage {
    enabled: config.feature_flags.my_form_enabled,
    ..ForgePackage::new(my_journey())
})?;
```

---

## ForgePackage

A `ForgePackage` bundles a journey definition with its custom
functions and components. Use `ForgePackage::new()` to create one:

```rust
use forge_core::ForgePackage;

let my_package = ForgePackage::new(my_journey())
    .with_functions(my_effects(services.clone()))
    .with_components([my_custom_component()]);
```

| Field | Type | Description |
|----------|------|-------------|
| `journey` | `Value` | The journey definition (set by `ForgePackage::new`). |
| `functions` | `Vec<FunctionEntry>` | Your custom conditions, transformers, generators, and effects (`with_functions()`, which can be called more than once). |
| `components` | `Vec<ComponentEntry>` | Custom components scoped to this journey (`with_components()`). |
| `enabled` | `bool` | Whether to register the package. Defaults to `true`. |

---

## Registering global components and functions

Components and functions registered globally are available to
all journeys:

```rust
forge
    .register_global_components(forge_govuk_components::components())?
    .register_global_functions(forge_runjucks::nunjucks_functions())?;
```

`register_global_functions()` accepts any iterator of
`FunctionEntry` values. Functions that need services capture them
when the entries are built:

```rust
forge.register_global_functions(my_conditions().into_iter().chain(my_transformers(services.clone())))?;
```

To register a single component, pass a one-item array:

```rust
forge.register_global_components([my_component()])?;
```

All registration methods return `ForgeResult<&mut Forge>`, so they
can be chained with `?`.

---

## Mounting on Topcoat

Once all journeys are registered, use `forge_topcoat::mount` to add
Forge's routes to a Topcoat router:

```rust
use std::sync::Arc;

use forge_topcoat::{AdapterOptions, mount};
use topcoat::router::Router;

let router = mount(Router::builder(), Arc::new(forge), Arc::new(renderer), AdapterOptions::default()).build();
```

If you configured a `basePath`, the routes are already prefixed:

```rust
let forge = Forge::new(ForgeOptions {
    base_path: "/forms".into(),
    ..ForgeOptions::default()
});

// Routes will be at /forms/my-journey/step-one, etc.
let router = mount(Router::builder(), Arc::new(forge), Arc::new(renderer), AdapterOptions::default()).build();
```
