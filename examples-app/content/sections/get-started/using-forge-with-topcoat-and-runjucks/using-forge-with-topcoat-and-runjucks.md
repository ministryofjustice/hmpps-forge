---
title: Using Forge with Topcoat and Runjucks
section: get-started
path: get-started/using-forge-with-topcoat-and-runjucks
teaches: [mount, runjucks-setup, page-template]
prerequisites: [Forge, register_global_components]
---

<p class="govuk-caption-xl">Get started</p>

# Using Forge with Topcoat and Runjucks
Forge ships with a framework adapter for Topcoat, with pages
rendered by Runjucks (a Rust implementation of Nunjucks). This
guide covers how to configure it and wire everything into a working
application.

{{slot:toc}}

---

## Configure Runjucks

The Topcoat adapter renders with Runjucks. When you create the
Runjucks environment, include the template directories for
`govuk-frontend`, `@ministryofjustice/frontend`, and Forge's own
MOJ component templates:

```rust
use forge_runjucks::{RunjucksEngine, RunjucksRenderer};

let engine = RunjucksEngine::new([
    "views".into(),
    "node_modules/govuk-frontend/dist".into(),
    "node_modules/@ministryofjustice/frontend".into(),
    forge_moj_components::templates_dir(),
]);
```

The order of directories matters. Your own `views/` directory comes
first so your templates can override defaults when needed.

The environment autoescapes output and registers the MOJ Frontend
`mojDate` filter and a `date` filter. Add your own filters and
globals through `engine.environment_mut()`.

---

## Mount Forge on a Topcoat router

Wrap the engine in a renderer, then pass your Forge instance and
the renderer to `forge_topcoat::mount`. It adds a Topcoat route for
every step and journey Forge knows about:

```rust
use std::sync::Arc;
use forge_topcoat::{AdapterOptions, mount};
use topcoat::router::Router;

let mut renderer = RunjucksRenderer::new(engine);
renderer.default_template = "partials/form-step".into();

let router = mount(Router::builder(), Arc::new(forge), Arc::new(renderer), AdapterOptions::default()).build();
```

Mount Forge after registering every package. The routes come from
the journeys registered at that point.

---

## Create a page template

The adapter renders each step using a Nunjucks template that you
provide. Create a file at `views/partials/form-step.njk`:

```nunjucks
{% extends "partials/layout.njk" %}
{% from "govuk/components/error-summary/macro.njk" import govukErrorSummary %}

{% block content %}
  <div class="govuk-grid-row">
    <div class="govuk-grid-column-two-thirds">
      {% set errorList = getErrorSummaryList() %}
      {% if errorList.length %}
        {{ govukErrorSummary({
          titleText: "There is a problem",
          errorList: errorList
        }) }}
      {% endif %}

      <form method="post" novalidate>
        <input type="hidden" name="_csrf" value="{{ csrfToken }}">
        {% for block in blocks %}
          {{ block | safe }}
        {% endfor %}
      </form>
    </div>
  </div>
{% endblock %}
```

The template uses three values:

- **blocks**: the rendered HTML for each block in the step
- **getErrorSummaryList()**: the step's failed validations as
  `{ text, href }` entries, ready for `govukErrorSummary`. Each `href`
  points at the failing field. The raw failures are also available
  as `fieldValidationErrors` and `domainValidationErrors`
- **csrfToken**: set by the adapter when CSRF protection is on (see
  below)

This template extends your base layout. If you do not already have a
`layout.njk`, see the
[GOV.UK Design System page template](https://design-system.service.gov.uk/styles/page-template/)
for setting up a page template.

---

## Sessions, forms and CSRF

The adapter reads form submissions itself: there is no body parsing
middleware to add. It also keeps a session per visitor, in memory by
default, under a `forge.sid` cookie. Use `AdapterOptions` to change
this behaviour:

```rust
let options = AdapterOptions {
    csrf: true,
    state: obj! { "serviceName": "My service" },
    ..AdapterOptions::default()
};
```

- `csrf` turns on synchronizer-token CSRF protection. The adapter
  puts a token in the session, exposes it to templates as
  `csrfToken`, and rejects a POST whose `_csrf` field does not match.
- `state` is shared with every template and with effects, as
  `request.state`.
- `sessions` replaces the in-memory session store with your own
  `SessionStore`.
- `headers`, `csp_nonce` and `error_page` add response headers, a
  per-request CSP nonce (`cspNonce` in templates), and templated
  error pages.

---

## Putting it together

Here is a minimal `main.rs` with all the pieces in place:

```rust
use std::sync::Arc;

use forge_core::{Forge, ForgeOptions};
use forge_runjucks::{RunjucksEngine, RunjucksRenderer};
use forge_topcoat::{AdapterOptions, mount};
use topcoat::router::Router;

#[tokio::main]
async fn main() {
    // Forge
    let mut forge = Forge::new(ForgeOptions::default());
    forge.register_global_components(forge_govuk_components::components()).expect("GOV.UK components");
    forge.register_global_components(forge_moj_components::components()).expect("MOJ components");

    // Register journey packages here
    // forge.register_package(my_package()).expect("my journey");

    // Template engine
    let engine = RunjucksEngine::new([
        "views".into(),
        "node_modules/govuk-frontend/dist".into(),
        "node_modules/@ministryofjustice/frontend".into(),
        forge_moj_components::templates_dir(),
    ]);
    let mut renderer = RunjucksRenderer::new(engine);
    renderer.default_template = "partials/form-step".into();

    // Routes
    let options = AdapterOptions { csrf: true, ..AdapterOptions::default() };
    let router = mount(Router::builder(), Arc::new(forge), Arc::new(renderer), options).build();

    // Listens on HOST and PORT (default 127.0.0.1:3000)
    topcoat::start(router).await.expect("server");
}
```

---

## What is next

Your application is configured and ready to serve journeys. Continue
to [Creating your first journey](creating-your-first-journey) to define
a journey and see it running in the browser.
