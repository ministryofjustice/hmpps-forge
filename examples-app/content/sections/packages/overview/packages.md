---
title: Packages
section: packages
path: packages/overview
teaches: [packages, forge-core, govuk-components, moj-components]
prerequisites: [journey, step, block]
---

<p class="govuk-caption-xl">Packages</p>

# Packages
Forge ships as a set of Rust crates in one Cargo workspace. Each
crate targets a different layer of the framework: the core engine,
the Topcoat adapter (with its Runjucks renderer), the GOV.UK Design
System components, and the Ministry of Justice components.

{{slot:toc}}

---

## What is a package?

A Forge package is a crate grouped by concern. The core crate
provides the engine, authoring API, and compilation pipeline. The
component crates provide pre-built blocks that render HTML following
the GOV.UK and MOJ design systems.

You import from the crate that matches what you need:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
```

---

## Available packages

- [Forge Core](forge-core) (`forge-core`) - the engine, authoring builders,
  compilation, and runtime. Everything you need to define and run
  journeys.
- [Topcoat Adapter](topcoat) - the framework adapter
  (`forge-topcoat` and `forge-runjucks`) that connects Forge to the
  Topcoat web framework and the Runjucks template engine. Handles
  routing, state merging, template resolution, and block rendering.
- [GOV.UK Components](govuk-components) (`forge-govuk-components`) - pre-built blocks for the
  GOV.UK Design System: text inputs, radios, checkboxes, date inputs,
  summary lists, panels, and more.
- [MOJ Components](moj-components) (`forge-moj-components`) - pre-built blocks for the
  Ministry of Justice Design System: banners, badges, filters, and
  other MOJ-specific patterns.
