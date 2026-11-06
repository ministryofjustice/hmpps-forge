---
title: Forge Core
section: packages
path: packages/forge-core/overview
teaches: [forge-core, core-authoring, core-components, core-framework]
prerequisites: [packages]
---

<p class="govuk-caption-xl">Packages</p>

# Forge Core
The core package contains everything needed to define, compile, and
run journeys. It has no framework or design system dependencies,
making it the foundation that all other packages build on.

{{slot:toc}}

---

## Modules

Forge Core is one crate, `forge-core`, with five modules you use
directly, each targeting a different concern:

### `forge_core`

The crate root: the engine and the types you register with it. This
is what you use when creating a `Forge` instance and registering
packages.

```rust
use forge_core::{Forge, ForgeOptions, ForgePackage, FunctionEntry, ComponentEntry, Value, obj};
```

### `forge_core::authoring`

Builders, conditions, transformers, generators, and all the
functions you use to define journeys.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
```

### `forge_core::builtins::components`

The built-in component set that ships with core: `core_blocks::HTML`,
`core_blocks::COLLECTION_BLOCK`, and `core_blocks::TEMPLATE_WRAPPER`. These are available in
every journey without registering a component library.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_core::builtins::components as core_blocks;
```

### `forge_core::framework`

Framework adapter interfaces (`RequestSnapshot`, `ResponseBindings`,
outcomes). Used when building a custom adapter for a framework other
than Topcoat.

```rust
use forge_core::framework::{RequestSnapshot, ResponseBindings};
```

### `forge_core::testing`

The in-memory test harness for exercising journeys without a real
web framework: `ForgeTestHarness`, `ForgeTestClient`, and
`TestEffectContext` for unit-testing effects.

```rust
use forge_core::testing::{ForgeTestHarness, TestEffectContext, TestRequestOptions};
```
