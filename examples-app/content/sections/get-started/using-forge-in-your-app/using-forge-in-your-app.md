---
title: Using Forge in your app
section: get-started
path: get-started/using-forge-in-your-app
teaches: [Forge, mount, register_global_components, register_package]
prerequisites: [installation]
---

<p class="govuk-caption-xl">Get started</p>

# Using Forge in your app
Forge has three setup steps: create an instance, register your
component libraries, and register your journey packages.

{{slot:toc}}

---

## Create a Forge instance

Create a Forge instance and register your component libraries and
journey packages. Forge itself is framework-agnostic - connecting
it to Topcoat happens separately via `forge_topcoat::mount`.

```rust
use forge_core::{Forge, ForgeOptions};

let mut forge = Forge::new(ForgeOptions::default());
```

The next guide,
[Using Forge with Topcoat and Runjucks](using-forge-with-topcoat-and-runjucks), covers
how to mount Forge on a Topcoat router and wire everything together.

---

## Register component libraries

Forge needs to know about the component libraries your journeys will
use. Register them after creating the Forge instance:

```rust
forge.register_global_components(forge_govuk_components::components())?;
forge.register_global_components(forge_moj_components::components())?;
```

This makes components like `govuk::TEXT_INPUT`, `govuk::RADIO_INPUT`, and
`govuk::BUTTON` available for use in your journey definitions.

Registration returns a `ForgeResult`: it fails if two libraries
register the same component variant.

You can register as many component libraries as you need, including
your own custom components.

---

## Register journey packages

Each journey is bundled into a package and registered with Forge.
You will create your first package in the
[Creating your first journey](creating-your-first-journey) guide, but
the registration call looks like this:

```rust
mod journeys;

forge.register_package(journeys::my_journey::package())?;
```

Registration compiles the journey. Authoring mistakes, such as a
reference to an unregistered component or an invalid expression, are
reported here, as an error that names the problem and where it is.

If a package depends on external services, give them to the
package's effect functions when you build it. Effects are closures,
so they capture the services they need:

```rust
let services = Arc::new(Services { my_api, data_store });

forge.register_package(journeys::my_journey::package(services.clone()))?;
```

The package moves an `Arc` of the services into each effect that
uses them. This keeps your journey definitions free of direct service
references. [Building custom effects](../components/building-custom-effects)
shows the pattern in full.

---

## What is next

You now have a Forge instance with component libraries registered.
Continue to [Using Forge with Topcoat and Runjucks](using-forge-with-topcoat-and-runjucks)
to mount Forge on a Topcoat router and wire it into your web application.
