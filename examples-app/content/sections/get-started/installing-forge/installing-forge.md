---
title: Installing Forge
section: get-started
path: get-started/installing-forge
teaches: [installation, project-structure]
prerequisites: []
---

<p class="govuk-caption-xl">Get started</p>

# Installing Forge
Add the Forge crates to your project and set up the dependencies your
service needs.

{{slot:toc}}

---

## What you need

Before you start, make sure you have:

- **Rust** 1.88 or later (the crates use the 2024 edition)
- **Cargo** (included with Rust)
- **Node.js and npm**, only to install the GOV.UK and MOJ frontend packages
- A working knowledge of **Rust**

You do not need prior experience with Forge. These guides assume you
are setting it up for the first time.

---

## Add the crates

Forge is a set of crates in the `hmpps-forge` repository. Add the ones
your service uses as git dependencies:

```toml
[dependencies]
forge-core = { git = "https://github.com/ministryofjustice/hmpps-forge" }
forge-runjucks = { git = "https://github.com/ministryofjustice/hmpps-forge" }
forge-topcoat = { git = "https://github.com/ministryofjustice/hmpps-forge" }
forge-govuk-components = { git = "https://github.com/ministryofjustice/hmpps-forge" }
forge-moj-components = { git = "https://github.com/ministryofjustice/hmpps-forge" }
```

`forge-core` is the engine and the journey DSL. The other crates add
the template renderer, the web framework adapter and the component
libraries. Each is described in [Packages](../packages/overview).

Forge renders templates with a patched copy of Runjucks that matches
Nunjucks exactly. Cargo does not pass `[patch]` sections on to the
crates that depend on Forge, so add the same patch to your own
`Cargo.toml`:

```toml
[patch.crates-io]
runjucks_core = { git = "https://github.com/ministryofjustice/hmpps-forge" }
```

Without it, GOV.UK and MOJ components still render, but some of their
markup differs from what real Nunjucks produces.

---

## Install framework dependencies

Forge connects to your web framework through a **framework adapter**.
This guide uses the provided Topcoat adapter (`forge-topcoat`), with
pages rendered by Runjucks. Your application code uses Topcoat and
Tokio directly, so add them alongside Forge:

```toml
[dependencies]
topcoat = "=0.11.0"
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
```

Topcoat is pinned to an exact version because it is still changing
quickly. Use the version Forge is built against.

---

## Project structure

A typical Forge project follows this layout:

```
my-service/
├── src/
│   ├── main.rs                 # Server entry point
│   ├── app.rs                  # Router setup
│   └── journeys/
│       └── my_journey/
│           ├── mod.rs          # Forge package
│           └── journey.rs      # Journey definition
├── views/
│   └── partials/
│       ├── layout.njk          # Base page layout
│       └── form-step.njk       # Forge step template
├── package.json                # Frontend packages
└── Cargo.toml
```

Journeys live under `src/journeys/`. Each journey has its own
module containing a journey definition and a package that
bundles it for registration with Forge.

Templates live under `views/`. They are Nunjucks templates, rendered
by Runjucks. Forge needs a step template that renders each step. You
will create this in the next guide.

---

## What is next

You now have Forge and its core dependencies installed. Continue to
[Install frontend libraries](install-frontend-libraries) to add the
GOV.UK and MOJ component packages that Forge renders with.
