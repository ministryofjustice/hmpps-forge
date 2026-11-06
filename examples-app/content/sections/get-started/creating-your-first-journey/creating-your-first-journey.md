---
title: Creating your first journey
section: get-started
path: get-started/creating-your-first-journey
teaches: []
prerequisites: [installation, Forge, mount]
---

<p class="govuk-caption-xl">Get started</p>

# Creating your first journey
Build a simple feedback form, register it with Forge, and see it
running in the browser.

{{slot:toc}}

---

## Define a journey

A journey is a data structure that describes a multi-page experience. Here
is one with three steps: a name page, a feedback page, and a
confirmation page.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

fn name_step() -> Value {
    step(obj! {
        "path": "/",
        "title": "What is your name?",
        "reachability": obj! { "entryWhen": true },
        "blocks": [
            govuk::TEXT_INPUT.build(obj! {
                "code": "fullName",
                "label": obj! {
                    "text": "What is your name?",
                    "isPageHeading": true,
                    "classes": "govuk-label--l",
                },
            }),
            govuk::BUTTON.build(obj! { "text": "Continue" }),
        ],
        "onSubmission": [submit(obj! {
            "validate": true,
            "onValid": obj! {
                "next": [redirect(obj! { "goto": "your-feedback" })],
            },
        })],
    })
}

fn feedback_step() -> Value {
    step(obj! {
        "path": "/your-feedback",
        "title": "Your feedback",
        "blocks": [
            govuk::TEXTAREA.build(obj! {
                "code": "feedback",
                "label": obj! {
                    "text": "Your feedback",
                    "isPageHeading": true,
                    "classes": "govuk-label--l",
                },
                "hint": obj! { "text": "Tell us what you think of this service." },
            }),
            govuk::BUTTON.build(obj! { "text": "Send feedback" }),
        ],
        "onSubmission": [submit(obj! {
            "validate": true,
            "onValid": obj! {
                "next": [redirect(obj! { "goto": "confirmation" })],
            },
        })],
    })
}

fn confirmation_step() -> Value {
    step(obj! {
        "path": "/confirmation",
        "title": "Feedback sent",
        "blocks": [govuk::PANEL.build(obj! { "titleText": "Feedback sent" })],
    })
}

pub fn feedback_journey() -> Value {
    journey(obj! {
        "code": "feedback",
        "title": "Give feedback",
        "path": "/feedback",
        "view": obj! { "template": "partials/form-step" },
        "steps": [name_step(), feedback_step(), confirmation_step()],
    })
}
```

Definitions are plain data. `obj!` builds an object with its keys in
the order you write them, and builders like `step` and `journey` mark
what each object is. Each component block is built with `.build(...)`
on the component, here from `forge_govuk_components::blocks`.

Each step declares its URL path, a title, and the blocks that make up
the page content. The `"reachability": obj! { "entryWhen": true }` property on the first step marks
it as the starting page.

The `onSubmission` hooks define what happens when the user submits
each step. Here they validate the input and redirect to the next step.

---

## How the pieces fit together

The journey produces the following routes:

```
journey(obj! { "path": "/feedback", .. })
├── step(obj! { "path": "/" })              → GET/POST /feedback
├── step(obj! { "path": "/your-feedback" }) → GET/POST /feedback/your-feedback
└── step(obj! { "path": "/confirmation" })  → GET/POST /feedback/confirmation
```

The `view.template` property tells the framework adapter which
template to use when rendering each step.

---

## Create a package

Forge needs journeys bundled into packages before they can be
registered. Create a `mod.rs` alongside your journey file:

```rust
mod journey;

use forge_core::ForgePackage;

pub fn package() -> ForgePackage {
    ForgePackage::new(journey::feedback_journey())
}
```

A package brings together the journey definition with any custom
functions and components it depends on. For this example, the journey
definition is all you need.

---

## Register the package

Register the package with your Forge instance before mounting the
router:

```rust
mod journeys;

forge.register_package(journeys::feedback::package()).expect("feedback journey");

let router = mount(Router::builder(), Arc::new(forge), Arc::new(renderer), options).build();
topcoat::start(router).await.expect("server");
```

---

## See it running

Start your application with `cargo run` and open `http://localhost:3000/feedback`.
You should see the name page rendered with GOV.UK styling.

Fill in the field and select **Continue**. You will move through the
feedback page to the confirmation panel.

---

## What you have built

With a journey definition and a package module, you have a working
multi-page journey that:

- renders pages with GOV.UK Design System components
- handles form submission and redirects between steps
- repopulates submitted values when a step re-renders after a
  failed validation
- produces accessible, standards-compliant HTML

---

## Going further

This journey does not yet validate user input or persist data. To build
on what you have:

- [Validation](../building-journeys/validation) explains how to add
  rules that check input before allowing submission.
- [Hooks and lifecycle](../building-journeys/hooks-and-lifecycle)
  covers the request pipeline and where to run custom logic.
- [Loading, saving and redirecting](../building-journeys/loading-saving-and-redirecting)
  shows common patterns for persisting data.

For a complete guide to everything Forge offers, continue to
[Building journeys](../building-journeys/overview).
