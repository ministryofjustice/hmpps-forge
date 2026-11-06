---
title: Topcoat Adapter
section: packages
path: packages/topcoat/overview
teaches: [forge-topcoat, forge-runjucks, mount]
prerequisites: [packages, journey, step, block]
---

<p class="govuk-caption-xl">Packages</p>

# Topcoat Adapter
The Topcoat adapter connects Forge to the Topcoat web framework
(`forge-topcoat`) and to Runjucks, a Rust implementation of the
Nunjucks template engine (`forge-runjucks`). It handles routing,
request mapping, state merging, template resolution, and block
rendering so that your journeys render as server-side HTML pages
within a Topcoat application.

{{slot:toc}}

---

## Entry point

```rust
use forge_runjucks::{RunjucksEngine, RunjucksRenderer};
use forge_topcoat::{AdapterOptions, mount};
```

---

## Setting up the router

Pass a Topcoat router builder, your Forge instance, a Runjucks
renderer, and the adapter options to `forge_topcoat::mount`:

```rust
use std::sync::Arc;

use forge_core::{Forge, ForgeOptions};
use forge_runjucks::{RunjucksEngine, RunjucksRenderer};
use forge_topcoat::{AdapterOptions, mount};
use topcoat::router::Router;

let engine = RunjucksEngine::new(["views"]);
let renderer = RunjucksRenderer::new(engine);

let forge = Forge::new(ForgeOptions::default());

let router = mount(Router::builder(), Arc::new(forge), Arc::new(renderer), AdapterOptions::default()).build();
```

### Configuration options

The `RunjucksRenderer` renders page templates and components:

| Field | Type | Default | Description |
|--------|------|---------|-------------|
| `engine` | `RunjucksEngine` | *required* | The template engine Forge will use to render page templates and components, over the template directories you list (`RunjucksEngine::new([...])`). It autoescapes. |
| `default_template` | `String` | `"form-step"` | The template file to render when neither the step nor any of its ancestor journeys specify a template. The `.njk` extension is appended automatically if not present. |

`AdapterOptions` configures the routes:

| Field | Type | Default | Description |
|--------|------|---------|-------------|
| `state` | `Value` | `{}` | Request state shared with templates and effects. |
| `request_state` | `Option<RequestStateFn>` | `None` | Per-request state merged over `state`; set it with `with_request_state()`. See [Request & State](request-state). |
| `sessions` | `Arc<dyn SessionStore>` | in memory | Where sessions are kept between requests. |
| `session_cookie` | `String` | `"forge.sid"` | The session cookie's name. |
| `csrf` | `bool` | `false` | Synchronizer-token CSRF protection: a token per session, exposed to templates as `csrfToken` and required as the `_csrf` field of every POST. |
| `csp_nonce` | `bool` | `false` | A fresh nonce per request, exposed to templates as `cspNonce`. |
| `headers` | `Vec<(HeaderName, HeaderValue)>` | `[]` | Headers added to every Forge response. `{nonce}` in a value is replaced with the request's nonce. |
| `error_page` | `Option<ErrorPage>` | `None` | Renders error pages for engine errors and error outcomes; plain text when unset. |

---

## What's in this section

- [Request & State](request-state) - how the adapter maps Topcoat
  requests into Forge's framework-agnostic model and merges
  per-request state over the fixed state.
- [Rendering](rendering) - how templates are resolved, what
  variables are available in the Nunjucks context, and how
  view locals merge.
- [Building Components](building-components) - using
  `nunjucks_render` to create template-rendered components
  and how validation errors reach them.
- [Nunjucks Generators](nunjucks-generators) - inline Nunjucks
  template composition with `generators::string`.
